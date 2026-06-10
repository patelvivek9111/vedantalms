const mongoose = require('mongoose');
const Notification = require('../../models/notification.model');
const observability = require('../workflowObservability.service');

function isNotificationDedupeEnabled() {
  return process.env.NOTIFICATION_DEDUPE_ENABLED === 'true';
}

/**
 * Canonical idempotency key: source:actor:relatedType:relatedId:eventWindow
 */
function buildDedupeKey({
  source = null,
  actorId = null,
  relatedType = null,
  relatedId = null,
  eventWindow = null,
  type = null,
} = {}) {
  const relatedIdStr = relatedId != null ? String(relatedId._id || relatedId) : null;
  const actorStr = actorId != null ? String(actorId._id || actorId) : null;
  const sourceStr = source || (type ? `type:${type}` : null);

  if (!sourceStr || !relatedType || !relatedIdStr) {
    return null;
  }

  const window = eventWindow != null ? String(eventWindow) : 'default';
  return [sourceStr, actorStr || 'na', relatedType, relatedIdStr, window].join(':');
}

function resolveDedupeKey(userId, notificationData = {}, options = {}) {
  if (options.dedupeKey) {
    return String(options.dedupeKey);
  }

  return buildDedupeKey({
    source: options.source,
    actorId: options.actorId,
    relatedType: notificationData.relatedType,
    relatedId: notificationData.relatedId,
    eventWindow: options.eventWindow,
    type: notificationData.type,
  });
}

async function findExistingNotification(userObjectId, dedupeKey) {
  if (!dedupeKey) return null;
  return Notification.findOne({
    user: userObjectId,
    dedupeKey,
  }).lean();
}

function recordDedupeMetric(event, fields = {}) {
  observability.metric(event, fields);
}

function isDuplicateKeyError(error) {
  return error?.code === 11000 || error?.name === 'MongoServerError' && /duplicate key/i.test(error?.message || '');
}

module.exports = {
  isNotificationDedupeEnabled,
  buildDedupeKey,
  resolveDedupeKey,
  findExistingNotification,
  recordDedupeMetric,
  isDuplicateKeyError,
};
