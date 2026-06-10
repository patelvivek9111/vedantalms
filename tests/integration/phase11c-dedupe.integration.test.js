const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Thread = require('../../models/thread.model');
const Notification = require('../../models/notification.model');
const {
  notifyAssignmentUpdated,
  notifyDiscussionReplyPosted,
  notifyGradesPosted,
  notifyGradesAmended,
} = require('../../services/notification/academicNotificationProducers.service');

describe('Phase 11C academic notification dedupe integration', () => {
  let mongoServer;
  let teacher;
  let student;
  let course;
  let moduleDoc;
  let assignment;
  let thread;

  const originalExpansion = process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED;
  const originalDedupe = process.env.NOTIFICATION_DEDUPE_ENABLED;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
    await Notification.syncIndexes();

    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
    process.env.NOTIFICATION_DEDUPE_ENABLED = 'true';

    teacher = await User.create({
      firstName: 'Dedupe',
      lastName: 'Teacher',
      email: `p11c-dedupe-t.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    student = await User.create({
      firstName: 'Dedupe',
      lastName: 'Student',
      email: `p11c-dedupe-s.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    course = await Course.create({
      title: 'Dedupe Course',
      description: 'Dedupe tests',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });

    moduleDoc = await Module.create({
      title: 'Week 1',
      course: course._id,
      published: true,
    });

    assignment = await Assignment.create({
      title: 'Lab',
      description: 'Work',
      module: moduleDoc._id,
      availableFrom: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 7 * 86400000),
      createdBy: teacher._id,
      published: true,
    });

    thread = await Thread.create({
      title: 'Topic',
      content: '<p>Hello</p>',
      course: course._id,
      author: teacher._id,
      published: true,
    });
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

  it('dedupes repeated assignment.updated events per recipient', async () => {
    await notifyAssignmentUpdated({ assignment, course, actor: teacher });
    await notifyAssignmentUpdated({ assignment, course, actor: teacher });

    const count = await Notification.countDocuments({ user: student._id });
    expect(count).toBe(1);
  });

  it('dedupes identical discussion.reply events but allows distinct reply IDs', async () => {
    const replyA = new mongoose.Types.ObjectId();
    const replyB = new mongoose.Types.ObjectId();

    await notifyDiscussionReplyPosted({
      thread,
      course,
      actor: teacher,
      replyId: replyA,
    });
    await notifyDiscussionReplyPosted({
      thread,
      course,
      actor: teacher,
      replyId: replyA,
    });
    await notifyDiscussionReplyPosted({
      thread,
      course,
      actor: teacher,
      replyId: replyB,
    });

    const count = await Notification.countDocuments({ user: student._id });
    expect(count).toBe(2);
  });

  it('dedupes repeated grades.posted fanout calls', async () => {
    await notifyGradesPosted({ course, actor: teacher });
    await notifyGradesPosted({ course, actor: teacher });

    const count = await Notification.countDocuments({ user: student._id });
    expect(count).toBe(1);
  });

  it('isolates grades.amended by amendment sequence', async () => {
    await notifyGradesAmended({
      course,
      studentIds: [student._id],
      actor: teacher,
      amendmentSequence: 1,
    });
    await notifyGradesAmended({
      course,
      studentIds: [student._id],
      actor: teacher,
      amendmentSequence: 1,
    });
    await notifyGradesAmended({
      course,
      studentIds: [student._id],
      actor: teacher,
      amendmentSequence: 2,
    });

    const count = await Notification.countDocuments({ user: student._id });
    expect(count).toBe(2);
  });
});
