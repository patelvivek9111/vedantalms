const mongoose = require('mongoose');
const Notification = require('../../models/notification.model');
const User = require('../../models/user.model');
const NotificationPreferences = require('../../models/notificationPreferences.model');
const { normalizeNotificationPayload } = require('./notificationPayload');
const {
  getPreferencesForUser,
  isInAppNotificationEnabled,
} = require('./notificationPreferences');
const {
  isNotificationDedupeEnabled,
  resolveDedupeKey,
  findExistingNotification,
  recordDedupeMetric,
  isDuplicateKeyError,
} = require('./notificationDedupe.service');
const { resolveDefaultExpiresAt } = require('./notificationRetention.service');
const { notifyNotificationInvalidated } = require('./notificationRealtime.service');

function resolveUserObjectId(userId) {
  if (userId == null) return null;
  if (userId instanceof mongoose.Types.ObjectId) return userId;
  if (typeof userId === 'object' && userId._id) {
    return resolveUserObjectId(userId._id);
  }
  if (typeof userId === 'string') {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    return new mongoose.Types.ObjectId(userId);
  }
  return userId;
}

async function prefetchNotificationRecipients(recipientIds = []) {
  const ids = [
    ...new Set(
      recipientIds.map((id) => resolveUserObjectId(id)).filter(Boolean)
    ),
  ];
  if (!ids.length) {
    return { users: new Map(), preferences: new Map() };
  }

  const [users, preferences] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('_id email firstName lastName').lean(),
    NotificationPreferences.find({ user: { $in: ids } }).lean(),
  ]);

  return {
    users: new Map(users.map((user) => [String(user._id), user])),
    preferences: new Map(preferences.map((pref) => [String(pref.user), pref])),
  };
}

/**
 * Creates an in-app notification when user preferences allow it.
 * Returns saved document or null when skipped/failed (producer-safe).
 */
async function createNotification(userId, notificationData = {}, options = {}) {
  const {
    requestId = null,
    source = null,
    actorId = null,
    eventWindow = null,
    prefetchCache = null,
  } = options;

  try {
    const userObjectId = resolveUserObjectId(userId);
    if (!userObjectId) {
      console.warn('notification_create_invalid_user_id', {
        userId: String(userId),
        requestId,
        source,
      });
      return null;
    }

    const user =
      prefetchCache?.users?.get(String(userObjectId)) ||
      (await User.findById(userObjectId).select('email firstName lastName').lean());
    if (!user) {
      console.warn('notification_create_user_not_found', {
        userId: String(userObjectId),
        requestId,
        source,
      });
      return null;
    }

    if (!notificationData?.type || !notificationData?.title || !notificationData?.message) {
      console.warn('notification_create_missing_required_fields', {
        userId: String(userObjectId),
        type: notificationData?.type || null,
        requestId,
        source,
      });
      return null;
    }

    const preferences =
      prefetchCache?.preferences?.get(String(userObjectId)) ??
      (await getPreferencesForUser(userObjectId));
    if (!isInAppNotificationEnabled(preferences, notificationData.type)) {
      return null;
    }

    const normalized = normalizeNotificationPayload(notificationData);

    let dedupeKey = null;
    if (isNotificationDedupeEnabled()) {
      dedupeKey = resolveDedupeKey(userObjectId, notificationData, {
        ...options,
        source,
        actorId,
        eventWindow,
      });
      if (dedupeKey) {
        const existing = await findExistingNotification(userObjectId, dedupeKey);
        if (existing) {
          recordDedupeMetric('notification_dedupe_hit', {
            userId: String(userObjectId),
            dedupeKey,
            notificationId: String(existing._id),
            source: source || null,
            requestId,
          });
          return await Notification.findById(existing._id);
        }
        recordDedupeMetric('notification_dedupe_miss', {
          userId: String(userObjectId),
          dedupeKey,
          source: source || null,
          requestId,
        });
      }
    }

    let expiresAt = normalized.expiresAt;
    if (expiresAt == null) {
      expiresAt = resolveDefaultExpiresAt(notificationData.type);
    }

    const notification = new Notification({
      user: userObjectId,
      ...normalized,
      ...(expiresAt != null ? { expiresAt } : {}),
      ...(dedupeKey ? { dedupeKey } : {}),
    });

    try {
      const saved = await notification.save();
      void notifyNotificationInvalidated({
        userId: userObjectId,
        reason: 'created',
        notificationId: saved._id,
        source: source || null,
      });
      return saved;
    } catch (error) {
      if (dedupeKey && isDuplicateKeyError(error)) {
        const existing = await findExistingNotification(userObjectId, dedupeKey);
        if (existing) {
          recordDedupeMetric('notification_dedupe_race_resolved', {
            userId: String(userObjectId),
            dedupeKey,
            notificationId: String(existing._id),
            requestId,
          });
          return await Notification.findById(existing._id);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('notification_create_failed', {
      error: error?.message || String(error),
      userId: String(userId?._id || userId || ''),
      type: notificationData?.type || null,
      requestId,
      source,
    });
    return null;
  }
}

module.exports = {
  createNotification,
  prefetchNotificationRecipients,
  resolveUserObjectId,
};
