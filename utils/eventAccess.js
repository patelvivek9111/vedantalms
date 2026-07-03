const Course = require('../models/course.model');

async function getPublishedEnrolledCourseIds(studentId) {
  const courses = await Course.find({ students: studentId, published: true }).select('_id');
  return courses.map((course) => course._id.toString());
}

/**
 * Students may read events on their personal calendar or enrolled course calendars.
 * Staff callers should be authorized before invoking this helper.
 */
async function studentCanAccessEvent(user, event) {
  if (!user || user.role !== 'student' || !event) return false;

  if (event.createdBy && event.createdBy.toString() === user._id.toString()) {
    return true;
  }

  const calendar = event.calendar ? String(event.calendar) : '';
  if (calendar === user._id.toString()) {
    return true;
  }

  const enrolledCourseIds = await getPublishedEnrolledCourseIds(user._id);
  return enrolledCourseIds.includes(calendar);
}

module.exports = {
  getPublishedEnrolledCourseIds,
  studentCanAccessEvent,
};
