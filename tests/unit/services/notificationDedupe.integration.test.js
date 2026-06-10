const mongoose = require('mongoose');
const Notification = require('../../../models/notification.model');
const User = require('../../../models/user.model');
const { waitForMongoConnection } = require('../../helpers');
const { createNotification } = require('../../../services/notification');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('notification dedupe integration', () => {
  const originalFlag = process.env.NOTIFICATION_DEDUPE_ENABLED;
  let userId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    try {
      await Notification.collection.dropIndex('notification_user_dedupe_unique');
    } catch (_) {
      /* ignore */
    }
    await Notification.syncIndexes();

    await User.deleteMany({ email: 'dedupe-int@test.com' });
    await Notification.deleteMany({});

    const user = await User.create({
      firstName: 'Dedupe',
      lastName: 'Test',
      email: 'dedupe-int@test.com',
      password: 'password123',
      role: 'student',
    });
    userId = user._id;
  });

  afterAll(async () => {
    process.env.NOTIFICATION_DEDUPE_ENABLED = originalFlag;
    await User.deleteMany({ email: 'dedupe-int@test.com' });
    await Notification.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Notification.deleteMany({ user: userId });
    process.env.NOTIFICATION_DEDUPE_ENABLED = 'true';
  });

  it('returns same notification on retry with identical dedupe key', async () => {
    const relatedId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const payload = {
      type: 'announcement',
      title: 'Announcement',
      message: 'New post',
      relatedId,
      relatedType: 'announcement',
    };
    const options = {
      source: 'announcement.created',
      actorId,
      eventWindow: 'default',
    };

    const first = await createNotification(userId, payload, options);
    const second = await createNotification(userId, payload, options);

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(String(first._id)).toBe(String(second._id));

    const count = await Notification.countDocuments({ user: userId });
    expect(count).toBe(1);
  });

  it('allows duplicate inserts when dedupe flag is disabled', async () => {
    process.env.NOTIFICATION_DEDUPE_ENABLED = 'false';
    const relatedId = new mongoose.Types.ObjectId();
    const payload = {
      type: 'announcement',
      title: 'Announcement',
      message: 'New post',
      relatedId,
      relatedType: 'announcement',
    };
    const options = {
      source: 'announcement.created',
      actorId: new mongoose.Types.ObjectId(),
    };

    const first = await createNotification(userId, payload, options);
    const second = await createNotification(userId, payload, options);

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(String(first._id)).not.toBe(String(second._id));
  });
});
