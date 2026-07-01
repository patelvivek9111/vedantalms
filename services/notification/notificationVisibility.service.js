const mongoose = require('mongoose');
const Notification = require('../../models/notification.model');
const Course = require('../../models/course.model');
const Assignment = require('../../models/Assignment');
const Module = require('../../models/module.model');

function courseIdFromMetadata(notification) {
  const meta = notification.metadata;
  if (!meta) return null;
  if (meta instanceof Map) {
    return meta.get('courseId') || null;
  }
  return meta.courseId || null;
}

async function resolveCourseIdForNotification(notification) {
  const fromMeta = courseIdFromMetadata(notification);
  if (fromMeta && mongoose.Types.ObjectId.isValid(fromMeta)) {
    return new mongoose.Types.ObjectId(fromMeta);
  }

  if (notification.relatedType === 'course' && notification.relatedId) {
    return notification.relatedId;
  }

  if (notification.relatedType === 'assignment' && notification.relatedId) {
    const assignment = await Assignment.findById(notification.relatedId).select('module').lean();
    if (!assignment?.module) return null;
    const mod = await Module.findById(assignment.module).select('course').lean();
    return mod?.course || null;
  }

  return null;
}

async function isNotificationVisibleToUser(notification, courseCache = new Map()) {
  const courseId = await resolveCourseIdForNotification(notification);
  if (!courseId) return { visible: true, reason: null };

  const cacheKey = String(courseId);
  let course = courseCache.get(cacheKey);
  if (!course) {
    course = await Course.findById(courseId).select('students instructor').lean();
    courseCache.set(cacheKey, course);
  }
  if (!course) {
    return { visible: false, reason: 'course_not_found' };
  }

  const userId = String(notification.user);
  const isStudent = (course.students || []).some((s) => String(s) === userId);
  const isInstructor = String(course.instructor) === userId;

  if (isStudent || isInstructor) {
    return { visible: true, reason: null };
  }

  return { visible: false, reason: 'not_course_participant' };
}

/**
 * Find in-app notifications that likely reference courses the user no longer accesses.
 */
async function findStaleNotifications({ userId = null, limit = 500 } = {}) {
  const query = { read: false };
  if (userId) query.user = userId;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const courseCache = new Map();
  const stale = [];

  for (const notification of notifications) {
    const visibility = await isNotificationVisibleToUser(notification, courseCache);
    if (!visibility.visible) {
      stale.push({
        notificationId: notification._id,
        userId: notification.user,
        type: notification.type,
        reason: visibility.reason,
        createdAt: notification.createdAt,
      });
    }
  }

  return stale;
}

async function reconcileStaleNotifications({ apply = false, userId = null, limit = 500 } = {}) {
  const stale = await findStaleNotifications({ userId, limit });

  if (apply && stale.length) {
    const ids = stale.map((row) => row.notificationId);
    await Notification.deleteMany({ _id: { $in: ids } });
  }

  return {
    scanned: stale.length,
    stale,
    applied: Boolean(apply),
  };
}

module.exports = {
  findStaleNotifications,
  reconcileStaleNotifications,
  isNotificationVisibleToUser,
};
