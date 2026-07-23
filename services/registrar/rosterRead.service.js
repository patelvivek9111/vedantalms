const Enrollment = require('../../models/enrollment.model');
const Course = require('../../models/course.model');
const User = require('../../models/user.model');
const { withTenantFilter } = require('../../utils/tenantContext');

const ACTIVE_STATUSES = ['active', 'completed'];

/**
 * Authoritative roster reads from Enrollment (teaching UX source of truth).
 * Falls back to Course.students when no Enrollment rows exist (legacy).
 */

async function listActiveStudentIds(courseId, { rootAccountId, includeCompleted = true } = {}) {
  const statuses = includeCompleted ? ACTIVE_STATUSES : ['active'];
  const filter = withTenantFilter(
    {
      lmsCourseId: courseId,
      role: 'student',
      status: { $in: statuses },
    },
    rootAccountId || undefined,
    { allowUnscoped: !rootAccountId }
  );

  const rows = await Enrollment.find(filter).select('studentId status').lean();
  if (rows.length) {
    return rows.map((r) => r.studentId);
  }

  const course = await Course.findById(courseId).select('students rootAccountId').lean();
  return course?.students || [];
}

async function listActiveStudents(courseId, { rootAccountId, select = 'firstName lastName email profilePicture role' } = {}) {
  const ids = await listActiveStudentIds(courseId, { rootAccountId });
  if (!ids.length) return [];
  return User.find({ _id: { $in: ids } }).select(select).lean();
}

async function isActivelyEnrolled(userId, courseId, { rootAccountId } = {}) {
  const filter = withTenantFilter(
    {
      lmsCourseId: courseId,
      studentId: userId,
      status: { $in: ACTIVE_STATUSES },
    },
    rootAccountId || undefined,
    { allowUnscoped: !rootAccountId }
  );
  const row = await Enrollment.findOne(filter).select('_id').lean();
  if (row) return true;

  const course = await Course.findById(courseId).select('students').lean();
  if (!course?.students?.length) return false;
  return course.students.some((id) => String(id) === String(userId));
}

async function listCourseIdsForStudent(studentId, { rootAccountId, publishedOnly = false } = {}) {
  const filter = withTenantFilter(
    {
      studentId,
      status: { $in: ACTIVE_STATUSES },
      role: 'student',
    },
    rootAccountId || undefined,
    { allowUnscoped: !rootAccountId }
  );
  const rows = await Enrollment.find(filter).select('lmsCourseId').lean();
  if (rows.length) {
    const ids = rows.map((r) => r.lmsCourseId);
    if (!publishedOnly) return ids;
    const courses = await Course.find({ _id: { $in: ids }, published: true }).select('_id').lean();
    return courses.map((c) => c._id);
  }

  const q = { students: studentId };
  if (rootAccountId) q.rootAccountId = rootAccountId;
  if (publishedOnly) q.published = true;
  const courses = await Course.find(q).select('_id').lean();
  return courses.map((c) => c._id);
}

module.exports = {
  ACTIVE_STATUSES,
  listActiveStudentIds,
  listActiveStudents,
  isActivelyEnrolled,
  listCourseIdsForStudent,
};
