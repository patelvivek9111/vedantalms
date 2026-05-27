const { delJson, getJson, setJson } = require('../utils/cache');

async function bumpWorkflowCacheVersion(scopeKey) {
  const key = `workflow-cache-version:${scopeKey}`;
  const current = Number((await getJson(key)) || 0);
  const next = current + 1;
  await setJson(key, next, 60 * 60 * 24);
  return next;
}

async function invalidateStudentCourseGrade(studentId, courseId) {
  await delJson(`grades:student:v3:${studentId}:course:${courseId}`);
  return bumpWorkflowCacheVersion(`student:${studentId}:course:${courseId}`);
}

module.exports = {
  bumpWorkflowCacheVersion,
  invalidateStudentCourseGrade,
};
