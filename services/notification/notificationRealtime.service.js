/**
 * Server-side invalidation emits for /notifications Socket.IO namespace.
 * No-ops when NOTIFICATION_WEBSOCKET_ENABLED is not true.
 */

const observability = require('../workflowObservability.service');

let notificationNamespace = null;

const EVENTS = {
  INVALIDATED: 'notification:invalidated',
};

const INVALIDATION_REASONS = new Set(['created', 'read', 'read_all', 'deleted']);

function isEnabled() {
  return (
    process.env.NOTIFICATION_WEBSOCKET_ENABLED === 'true' && notificationNamespace != null
  );
}

function setNotificationNamespace(nsp) {
  notificationNamespace = nsp || null;
}

function normalizeId(value) {
  if (!value) return '';
  return String(value._id || value);
}

function userRoom(userId) {
  return `user:${normalizeId(userId)}`;
}

function emitToUser(userId, event, payload) {
  if (!isEnabled()) return;
  const room = userRoom(userId);
  notificationNamespace.to(room).emit(event, payload);
}

/**
 * Tell clients to refetch notification list / unread badge (no payload bodies).
 */
async function notifyNotificationInvalidated({
  userId,
  reason = 'created',
  notificationId = null,
  source = null,
} = {}) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return;

  const safeReason = INVALIDATION_REASONS.has(reason) ? reason : 'created';
  const payload = {
    userId: normalizedUserId,
    reason: safeReason,
    notificationId: notificationId ? normalizeId(notificationId) : undefined,
    at: new Date().toISOString(),
  };

  emitToUser(normalizedUserId, EVENTS.INVALIDATED, payload);

  observability.metric('notification_realtime_invalidated', {
    reason: safeReason,
    hasNotificationId: Boolean(payload.notificationId),
    source: source || null,
  });
}

module.exports = {
  EVENTS,
  INVALIDATION_REASONS,
  isEnabled,
  setNotificationNamespace,
  notifyNotificationInvalidated,
  userRoom,
};
