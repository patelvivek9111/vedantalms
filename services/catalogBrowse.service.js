const mongoose = require('mongoose');

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function shapeCatalogCourse(course, userId) {
  const doc = typeof course.toObject === 'function' ? course.toObject() : { ...course };
  const studentIds = (doc.students || []).map(normalizeId);
  const uid = userId ? String(userId) : null;

  doc.studentCount = studentIds.length;
  doc.waitlistCount = (doc.waitlist || []).length;
  doc.isEnrolled = uid ? studentIds.includes(uid) : false;
  doc.hasEnrollmentRequest = uid
    ? (doc.enrollmentRequests || []).some((req) => normalizeId(req.student) === uid)
    : false;
  const waitlistEntry = uid
    ? (doc.waitlist || []).find((entry) => normalizeId(entry.student) === uid)
    : null;
  doc.isOnWaitlist = Boolean(waitlistEntry);
  doc.waitlistPosition = waitlistEntry?.position ?? null;

  delete doc.students;
  delete doc.enrollmentRequests;
  delete doc.waitlist;

  return doc;
}

module.exports = {
  shapeCatalogCourse,
};
