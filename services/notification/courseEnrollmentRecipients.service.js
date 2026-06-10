const mongoose = require('mongoose');
const Course = require('../../models/course.model');
const User = require('../../models/user.model');

function normalizeObjectIdString(value) {
  if (value == null) return null;
  const id = value._id || value;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return String(id);
}

function extractRosterStudentIds(course) {
  if (!course || !Array.isArray(course.students)) return [];
  return course.students.map(normalizeObjectIdString).filter(Boolean);
}

/**
 * Resolve course roster IDs that represent active student enrollments.
 * Filters to users that exist with role `student` (excludes stale roster entries,
 * non-student roles, and withdrawn students removed from course.students).
 */
async function resolveActiveCourseStudentIds(courseOrCourseId) {
  const courseId = normalizeObjectIdString(courseOrCourseId?._id || courseOrCourseId);
  if (!courseId) return [];

  const course =
    courseOrCourseId &&
    typeof courseOrCourseId === 'object' &&
    Array.isArray(courseOrCourseId.students)
      ? courseOrCourseId
      : await Course.findById(courseId).select('students').lean();

  const rosterIds = extractRosterStudentIds(course);
  if (!rosterIds.length) return [];

  const objectIds = rosterIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const activeStudents = await User.find({
    _id: { $in: objectIds },
    role: 'student',
  })
    .select('_id')
    .lean();

  const activeSet = new Set(activeStudents.map((user) => String(user._id)));
  return rosterIds.filter((id) => activeSet.has(id));
}

/**
 * Intersect candidate recipient IDs with active course enrollments.
 */
async function filterToActiveCourseStudentIds(candidateIds = [], courseOrCourseId) {
  if (!Array.isArray(candidateIds) || !candidateIds.length) return [];

  const activeIds = new Set(await resolveActiveCourseStudentIds(courseOrCourseId));
  if (!activeIds.size) return [];

  const seen = new Set();
  const filtered = [];

  for (const candidate of candidateIds) {
    const id = normalizeObjectIdString(candidate);
    if (!id || !activeIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    filtered.push(id);
  }

  return filtered;
}

async function isActiveCourseStudent(userId, courseOrCourseId) {
  const id = normalizeObjectIdString(userId);
  if (!id) return false;
  const activeIds = await resolveActiveCourseStudentIds(courseOrCourseId);
  return activeIds.includes(id);
}

module.exports = {
  normalizeObjectIdString,
  extractRosterStudentIds,
  resolveActiveCourseStudentIds,
  filterToActiveCourseStudentIds,
  isActiveCourseStudent,
};
