const mongoose = require('mongoose');
const {
  isNotificationDedupeEnabled,
  buildDedupeKey,
  resolveDedupeKey,
} = require('../../../services/notification/notificationDedupe.service');

describe('notificationDedupe.service', () => {
  const originalFlag = process.env.NOTIFICATION_DEDUPE_ENABLED;

  afterEach(() => {
    process.env.NOTIFICATION_DEDUPE_ENABLED = originalFlag;
  });

  it('is disabled by default', () => {
    delete process.env.NOTIFICATION_DEDUPE_ENABLED;
    expect(isNotificationDedupeEnabled()).toBe(false);
    process.env.NOTIFICATION_DEDUPE_ENABLED = 'true';
    expect(isNotificationDedupeEnabled()).toBe(true);
  });

  it('builds canonical dedupe key', () => {
    const relatedId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const key = buildDedupeKey({
      source: 'announcement.created',
      actorId,
      relatedType: 'announcement',
      relatedId,
      eventWindow: 'default',
    });
    expect(key).toBe(
      `announcement.created:${String(actorId)}:announcement:${String(relatedId)}:default`
    );
  });

  it('returns null when required parts are missing', () => {
    expect(buildDedupeKey({ source: 'x', relatedType: 'announcement' })).toBeNull();
  });

  it('prefers explicit dedupeKey in options', () => {
    const key = resolveDedupeKey(
      new mongoose.Types.ObjectId(),
      { relatedType: 'course', relatedId: new mongoose.Types.ObjectId() },
      { dedupeKey: 'custom:key' }
    );
    expect(key).toBe('custom:key');
  });
});
