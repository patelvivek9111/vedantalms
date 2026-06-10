const mongoose = require('mongoose');
const Notification = require('../../models/notification.model');
const observability = require('../workflowObservability.service');
const { notifyNotificationInvalidated } = require('./notificationRealtime.service');

/** Fields returned to API clients (excludes internal dedupeKey). */
const LIST_PROJECTION = {
  _id: 1,
  user: 1,
  type: 1,
  title: 1,
  message: 1,
  link: 1,
  read: 1,
  readAt: 1,
  relatedId: 1,
  relatedType: 1,
  priority: 1,
  expiresAt: 1,
  createdAt: 1,
  updatedAt: 1,
  metadata: 1,
};

function serializeNotification(doc) {
  if (!doc) return doc;
  const out = { ...doc };
  if (out.metadata instanceof Map) {
    out.metadata = Object.fromEntries(out.metadata);
  }
  delete out.dedupeKey;
  return out;
}

function buildListMatch(userId, { read, type } = {}) {
  const match = { user: new mongoose.Types.ObjectId(userId) };
  if (type) match.type = type;
  if (read !== undefined) match.read = read;
  return match;
}

function recordReadMetric(endpoint, { queryCount, resultCount, durationMs, extra = {} }) {
  observability.metric('notification_read_completed', {
    endpoint,
    queryCount,
    resultCount,
    durationMs,
    ...extra,
  });
}

/**
 * Paginated notification list + pagination meta + global unread count (legacy contract).
 */
async function listNotificationsForUser(userId, { read, type, limit = 50, page = 1 } = {}) {
  const started = Date.now();
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (pageNum - 1) * limitNum;
  const match = buildListMatch(userId, { read, type });

  const [facetResult, unreadCount] = await Promise.all([
    Notification.aggregate([
      { $match: match },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
            { $project: LIST_PROJECTION },
          ],
          filteredTotal: [{ $count: 'count' }],
        },
      },
    ]),
    Notification.countDocuments({ user: userId, read: false }),
  ]);

  const facet = facetResult[0] || { data: [], filteredTotal: [] };
  const total = facet.filteredTotal[0]?.count ?? 0;
  const data = (facet.data || []).map(serializeNotification);

  recordReadMetric('list', {
    queryCount: 2,
    resultCount: data.length,
    durationMs: Date.now() - started,
    total,
    unreadCount,
  });

  return {
    data,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 0,
    },
    unreadCount,
  };
}

async function getUnreadCountForUser(userId) {
  const started = Date.now();
  const count = await Notification.countDocuments({ user: userId, read: false });
  recordReadMetric('unread_count', {
    queryCount: 1,
    resultCount: count,
    durationMs: Date.now() - started,
  });
  return count;
}

async function markNotificationReadForUser(userId, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { read: true, readAt: new Date() } },
    { new: true, projection: LIST_PROJECTION }
  ).lean();

  if (notification) {
    void notifyNotificationInvalidated({
      userId,
      reason: 'read',
      notificationId,
    });
  }

  return notification ? serializeNotification(notification) : null;
}

async function markAllNotificationsReadForUser(userId) {
  const result = await Notification.updateMany(
    { user: userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );

  if (result.modifiedCount > 0) {
    void notifyNotificationInvalidated({
      userId,
      reason: 'read_all',
    });
  }

  return result;
}

async function deleteNotificationForUser(userId, notificationId) {
  const deleted = await Notification.findOneAndDelete({
    _id: notificationId,
    user: userId,
  }).lean();

  if (deleted) {
    void notifyNotificationInvalidated({
      userId,
      reason: 'deleted',
      notificationId,
    });
  }

  return deleted;
}

module.exports = {
  LIST_PROJECTION,
  serializeNotification,
  listNotificationsForUser,
  getUnreadCountForUser,
  markNotificationReadForUser,
  markAllNotificationsReadForUser,
  deleteNotificationForUser,
};
