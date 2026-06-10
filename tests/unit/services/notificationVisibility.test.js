const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../mongoMemoryServer');
const Course = require('../../../models/course.model');
const Notification = require('../../../models/notification.model');
const User = require('../../../models/user.model');
const {
  findStaleNotifications,
} = require('../../../services/notification/notificationVisibility.service');

describe('notificationVisibility.service', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('flags notifications for courses the user is not in', async () => {
    const instructor = await User.create({
      firstName: 'T',
      lastName: 'Each',
      email: 'teacher-vis@test.com',
      password: 'password123',
      role: 'teacher',
    });
    const outsider = await User.create({
      firstName: 'O',
      lastName: 'Side',
      email: 'outsider-vis@test.com',
      password: 'password123',
      role: 'student',
    });
    const course = await Course.create({
      title: 'Visibility Course',
      description: 'Test course for visibility reconciliation',
      instructor: instructor._id,
      students: [],
    });

    await Notification.create({
      user: outsider._id,
      type: 'announcement',
      title: 'Stale',
      message: 'Should not be visible',
      metadata: { courseId: String(course._id) },
      read: false,
    });

    const stale = await findStaleNotifications({ userId: outsider._id });
    expect(stale.length).toBe(1);
    expect(stale[0].reason).toBe('not_course_participant');
  });
});
