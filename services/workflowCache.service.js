const { delJson, deleteKeysByPrefix, getJson, setJson } = require('../utils/cache');

const STUDENT_GRADE_CACHE_PREFIX = 'grades:student';

/** Build Redis cache key for GET /api/grades/student/course/:courseId */
function studentCourseGradeCacheKey(studentId, courseId, policyHash) {
  const sid = String(studentId);
  const cid = String(courseId);
  const hash = policyHash ? String(policyHash) : 'default';
  return `${STUDENT_GRADE_CACHE_PREFIX}:v5:${sid}:course:${cid}:${hash}`;
}

async function bumpWorkflowCacheVersion(scopeKey) {
  const key = `workflow-cache-version:${scopeKey}`;
  const current = Number((await getJson(key)) || 0);
  const next = current + 1;
  await setJson(key, next, 60 * 60 * 24);
  return next;
}

async function invalidateStudentCourseGrade(studentId, courseId) {
  const sid = String(studentId);
  const cid = String(courseId);
  await Promise.all([
    delJson(`${STUDENT_GRADE_CACHE_PREFIX}:v3:${sid}:course:${cid}`),
    delJson(`${STUDENT_GRADE_CACHE_PREFIX}:v4:${sid}:course:${cid}`),
    deleteKeysByPrefix(`${STUDENT_GRADE_CACHE_PREFIX}:v5:${sid}:course:${cid}:`),
  ]);
  require('./dashboardGradeSummary.service').scheduleRefreshStudents(cid, [sid]);
  return bumpWorkflowCacheVersion(`student:${sid}:course:${cid}`);
}

/** Drop cached student course totals after policy or gradebook changes. */
async function invalidateAllStudentCourseGrades(courseId) {
  const Course = require('../models/course.model');
  const course = await Course.findById(courseId).select('students').lean();
  const studentIds = course?.students || [];
  if (!studentIds.length) return;
  const cid = String(courseId);
  await Promise.all(
    studentIds.map(async (sid) => {
      const s = String(sid?._id || sid);
      await Promise.all([
        delJson(`${STUDENT_GRADE_CACHE_PREFIX}:v3:${s}:course:${cid}`),
        delJson(`${STUDENT_GRADE_CACHE_PREFIX}:v4:${s}:course:${cid}`),
        deleteKeysByPrefix(`${STUDENT_GRADE_CACHE_PREFIX}:v5:${s}:course:${cid}:`),
      ]);
      await bumpWorkflowCacheVersion(`student:${s}:course:${cid}`);
    })
  );
  require('./dashboardGradeSummary.service').scheduleRefreshCourse(cid);
}

module.exports = {
  STUDENT_GRADE_CACHE_PREFIX,
  studentCourseGradeCacheKey,
  bumpWorkflowCacheVersion,
  invalidateStudentCourseGrade,
  invalidateAllStudentCourseGrades,
};
