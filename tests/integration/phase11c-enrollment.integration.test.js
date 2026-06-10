const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Notification = require('../../models/notification.model');
const {
  notifyAssignmentPublished,
  notifyCoursePublished,
  notifyGradesAmended,
} = require('../../services/notification/academicNotificationProducers.service');

describe('Phase 11C active enrollment recipient filtering', () => {
  let mongoServer;
  let teacher;
  let activeStudent;
  let withdrawnStudent;
  let course;
  let moduleDoc;
  let assignment;

  const originalExpansion = process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED;
  const originalDedupe = process.env.NOTIFICATION_DEDUPE_ENABLED;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
    await Notification.syncIndexes();

    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
    process.env.NOTIFICATION_DEDUPE_ENABLED = 'false';

    teacher = await User.create({
      firstName: 'Ann',
      lastName: 'Teacher',
      email: `p11c-teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    activeStudent = await User.create({
      firstName: 'Active',
      lastName: 'Enrolled',
      email: `p11c-active.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    withdrawnStudent = await User.create({
      firstName: 'With',
      lastName: 'Drawn',
      email: `p11c-withdrawn.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    course = await Course.create({
      title: 'Phase 11C Course',
      description: 'Enrollment filtering',
      instructor: teacher._id,
      students: [activeStudent._id, withdrawnStudent._id, teacher._id],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });

    moduleDoc = await Module.create({
      title: 'Week 1',
      course: course._id,
      published: true,
    });

    assignment = await Assignment.create({
      title: 'Essay',
      description: 'Write',
      module: moduleDoc._id,
      availableFrom: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 7 * 86400000),
      createdBy: teacher._id,
      published: true,
    });

    course.students = course.students.filter(
      (id) => String(id) !== String(withdrawnStudent._id)
    );
    await course.save();
  });

  afterAll(async () => {
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = originalExpansion;
    process.env.NOTIFICATION_DEDUPE_ENABLED = originalDedupe;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  it('notifies only active enrolled students on assignment.published', async () => {
    await notifyAssignmentPublished({
      assignment,
      course,
      actor: teacher,
    });

    const notifications = await Notification.find({}).lean();
    const userIds = notifications.map((n) => String(n.user));

    expect(userIds).toContain(String(activeStudent._id));
    expect(userIds).not.toContain(String(withdrawnStudent._id));
    expect(userIds).not.toContain(String(teacher._id));
    expect(notifications).toHaveLength(1);
  });

  it('notifies only active enrolled students on course.published', async () => {
    await notifyCoursePublished({ course, actor: teacher });

    const notifications = await Notification.find({}).lean();
    expect(notifications).toHaveLength(1);
    expect(String(notifications[0].user)).toBe(String(activeStudent._id));
  });

  it('filters grades.amended recipients to active enrollments', async () => {
    await notifyGradesAmended({
      course,
      studentIds: [activeStudent._id, withdrawnStudent._id],
      actor: teacher,
      reason: 'Correction',
      amendmentSequence: 1,
    });

    const notifications = await Notification.find({}).lean();
    expect(notifications).toHaveLength(1);
    expect(String(notifications[0].user)).toBe(String(activeStudent._id));
  });
});
