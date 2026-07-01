const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../mongoMemoryServer');
const Course = require('../../../models/course.model');
const Module = require('../../../models/module.model');
const Assignment = require('../../../models/Assignment');
const Submission = require('../../../models/Submission');
const Todo = require('../../../models/todo.model');
const Notification = require('../../../models/notification.model');
const User = require('../../../models/user.model');
const {
  deleteCourseAndRelatedData,
  pruneOrphanCourseData,
} = require('../../../services/courseDeleteCascade.service');
const {
  pruneOrphanCourseNotificationsForUser,
} = require('../../../services/notification/notificationCourseCleanup.service');

describe('courseDeleteCascade.service', () => {
  let mongoServer;
  let instructor;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Course.deleteMany({}),
      Module.deleteMany({}),
      Assignment.deleteMany({}),
      Submission.deleteMany({}),
      Todo.deleteMany({}),
      Notification.deleteMany({}),
      User.deleteMany({}),
    ]);

    instructor = await User.create({
      firstName: 'Cascade',
      lastName: 'Teacher',
      email: `cascade-teacher-${Date.now()}@test.com`,
      password: 'password123',
      role: 'teacher',
      preferences: { courseColors: {} },
    });
  });

  it('deletes course children, todos, and notifications', async () => {
    const course = await Course.create({
      title: 'Cascade Course',
      description: 'Course to delete with related data',
      instructor: instructor._id,
      students: [],
    });
    instructor.preferences.courseColors[String(course._id)] = '#ff0000';
    await instructor.save();

    const module = await Module.create({
      title: 'Mod 1',
      course: course._id,
      description: 'Module',
    });
    const assignment = await Assignment.create({
      title: 'HW 1',
      description: 'Do work',
      module: module._id,
      createdBy: instructor._id,
      dueDate: new Date(Date.now() + 86400000),
      availableFrom: new Date(),
    });
    await Submission.create({
      assignment: assignment._id,
      student: instructor._id,
      submittedBy: instructor._id,
      status: 'submitted',
      submittedAt: new Date(),
    });
    await Todo.create({
      title: '1 student needs your review',
      dueDate: new Date(),
      user: instructor._id,
      type: 'enrollment_request',
      courseId: course._id,
      courseName: course.title,
      action: 'pending',
    });
    await Notification.create({
      user: instructor._id,
      type: 'submission',
      title: 'New submission',
      message: 'Student submitted',
      metadata: { courseId: String(course._id) },
      relatedType: 'assignment',
      relatedId: assignment._id,
    });

    const result = await deleteCourseAndRelatedData(course._id);
    expect(result.ok).toBe(true);
    expect(result.deleted.modules).toBe(1);
    expect(result.deleted.assignments).toBe(1);
    expect(result.deleted.submissions).toBe(1);
    expect(result.deleted.todos).toBe(1);
    expect(result.deleted.notifications).toBeGreaterThanOrEqual(1);
    expect(result.deleted.course).toBe(1);

    expect(await Course.findById(course._id)).toBeNull();
    expect(await Module.countDocuments({ course: course._id })).toBe(0);
    expect(await Assignment.countDocuments({ module: module._id })).toBe(0);
    expect(await Submission.countDocuments({ assignment: assignment._id })).toBe(0);
    expect(await Todo.countDocuments({ courseId: course._id })).toBe(0);
    expect(await Notification.countDocuments({ user: instructor._id })).toBe(0);

    const refreshedUser = await User.findById(instructor._id).lean();
    expect(refreshedUser.preferences?.courseColors?.[String(course._id)]).toBeUndefined();
  });

  it('prunes orphan data when course document is already gone', async () => {
    const missingId = new mongoose.Types.ObjectId();
    await Module.create({
      title: 'Orphan module',
      course: missingId,
      description: 'Left behind',
    });
    await Todo.create({
      title: '1 student needs your review',
      dueDate: new Date(),
      user: instructor._id,
      type: 'enrollment_request',
      courseId: missingId,
      courseName: 'Missing',
      action: 'pending',
    });

    const report = await pruneOrphanCourseData();
    expect(report.orphanCourseIds).toContain(String(missingId));
    expect(await Module.countDocuments({ course: missingId })).toBe(0);
    expect(await Todo.countDocuments({ courseId: missingId })).toBe(0);
  });
});

describe('notificationCourseCleanup.service', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([Notification.deleteMany({}), User.deleteMany({})]);
  });

  it('removes notifications for deleted courses on prune', async () => {
    const user = await User.create({
      firstName: 'Notify',
      lastName: 'User',
      email: `notify-${Date.now()}@test.com`,
      password: 'password123',
      role: 'teacher',
    });
    const missingId = new mongoose.Types.ObjectId();

    await Notification.create({
      user: user._id,
      type: 'announcement',
      title: 'Stale course',
      message: 'Gone',
      metadata: { courseId: String(missingId) },
      read: false,
    });

    const pruned = await pruneOrphanCourseNotificationsForUser(user._id);
    expect(pruned).toBe(1);
    expect(await Notification.countDocuments({ user: user._id })).toBe(0);
  });
});
