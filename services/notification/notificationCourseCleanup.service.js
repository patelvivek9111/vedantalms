const mongoose = require('mongoose');
const Notification = require('../../models/notification.model');
const { isNotificationVisibleToUser } = require('./notificationVisibility.service');

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

/** Remove notifications pointing at deleted or inaccessible courses. */
async function pruneOrphanCourseNotificationsForUser(userId) {
  const notifications = await Notification.find({ user: userId })
    .select('_id relatedId relatedType metadata link user')
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

module.exports = {
  deleteNotificationsForCourse,
  pruneOrphanCourseNotificationsForUser,
};
