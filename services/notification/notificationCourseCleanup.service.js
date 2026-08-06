const mongoose = require('mongoose');
const Notification = require('../../models/notification.model');
const { isNotificationVisibleToUser } = require('./notificationVisibility.service');

const lastPruneByUser = new Map();
const DEFAULT_PRUNE_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_PRUNE_LIMIT = 100;

function courseIdMatchFilters(courseId) {
  const id = new mongoose.Types.ObjectId(String(courseId));
  const idStr = String(id);
  return [
    { relatedType: 'course', relatedId: id },
    { 'metadata.courseId': idStr },
    { 'metadata.courseId': id },
    { link: { $regex: `/courses/${idStr}(/|$)` } },
  ];
}

async function deleteNotificationsForCourse(courseId, { assignmentIds = [], threadIds = [] } = {}) {
  const or = courseIdMatchFilters(courseId);
  if (assignmentIds.length) {
    or.push({ relatedType: 'assignment', relatedId: { $in: assignmentIds } });
  }
  if (threadIds.length) {
    or.push({ relatedType: 'discussion', relatedId: { $in: threadIds } });
  }
  const result = await Notification.deleteMany({ $or: or });
  return result.deletedCount;
}

/**
 * Remove notifications pointing at deleted courses.
 * Bounded scan — never loads a user's full notification history.
 */
async function pruneOrphanCourseNotificationsForUser(userId, options = {}) {
  const limit = Math.min(Math.max(options.limit || DEFAULT_PRUNE_LIMIT, 1), 500);
  const notifications = await Notification.find({
    user: userId,
    $or: [
      { relatedType: 'course' },
      { relatedType: 'assignment' },
      { 'metadata.courseId': { $exists: true, $ne: null } },
      { link: { $regex: '/courses/' } },
    ],
  })
    .select('_id relatedId relatedType metadata link user')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (!notifications.length) return 0;

  const courseCache = new Map();
  const orphanIds = [];

  for (const notification of notifications) {
    const visibility = await isNotificationVisibleToUser(notification, courseCache);
    if (!visibility.visible && visibility.reason === 'course_not_found') {
      orphanIds.push(notification._id);
    }
  }

  if (!orphanIds.length) return 0;
  const result = await Notification.deleteMany({ _id: { $in: orphanIds } });
  return result.deletedCount;
}

/** Throttled prune for hot paths (notification list). */
async function maybePruneOrphanCourseNotificationsForUser(userId, options = {}) {
  const intervalMs = options.intervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
  const key = String(userId);
  const last = lastPruneByUser.get(key) || 0;
  if (Date.now() - last < intervalMs) return 0;
  lastPruneByUser.set(key, Date.now());
  return pruneOrphanCourseNotificationsForUser(userId, options);
}

module.exports = {
  deleteNotificationsForCourse,
  pruneOrphanCourseNotificationsForUser,
  maybePruneOrphanCourseNotificationsForUser,
};
