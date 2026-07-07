const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const Notification = require('../../models/notification.model');
const User = require('../../models/user.model');
const { serializeNotification } = require('../../services/notification/notificationRead.service');

describe('notification metadata Map serialization integration', () => {
  let mongoServer;
  let user;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());

    user = await User.create({
      firstName: 'Notify',
      lastName: 'User',
      email: `notify-meta-${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  test('stored metadata Map survives toObject and JSON serialization', async () => {
    const created = await Notification.create({
      user: user._id,
      type: 'assignment_graded',
      title: 'Graded',
      message: 'Your assignment was graded',
      metadata: {
        courseId: 'course-abc',
        assignmentId: 'assign-xyz',
        nested: { score: 95 },
      },
    });

    const doc = await Notification.findById(created._id);
    expect(doc.metadata instanceof Map).toBe(true);
    expect(doc.toObject().metadata).toEqual({
      courseId: 'course-abc',
      assignmentId: 'assign-xyz',
      nested: { score: 95 },
    });
    expect(JSON.parse(JSON.stringify(doc)).metadata).toEqual({
      courseId: 'course-abc',
      assignmentId: 'assign-xyz',
      nested: { score: 95 },
    });
  });

  test('serializeNotification flattens metadata from mongoose document', async () => {
    const created = await Notification.create({
      user: user._id,
      type: 'submission',
      title: 'New submission',
      message: 'A student submitted work',
      dedupeKey: 'secret-dedupe',
      metadata: { courseId: 'c1', submissionId: 's1' },
    });

    const doc = await Notification.findById(created._id);
    const out = serializeNotification(doc);

    expect(out.dedupeKey).toBeUndefined();
    expect(out.metadata).toEqual({ courseId: 'c1', submissionId: 's1' });
  });
});
