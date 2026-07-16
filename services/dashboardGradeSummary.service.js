/**
 * Canvas-style materialized dashboard grade summaries.
 * Write path: recompute and persist when grades change.
 * Read path: single DB query — no grade engine on dashboard load.
 */
const Course = require('../models/course.model');
const CourseEnrollmentGrade = require('../models/courseEnrollmentGrade.model');
const { computeStudentCourseGrade } = require('./gradeCalculation.service');
const gradingPolicyService = require('./gradingPolicy.service');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const { loadCourseGradeAssignments } = require('./gradeCalculationInputs.service');

function normalizeId(id) {
  if (id && typeof id === 'object' && id._id) return String(id._id);
  return String(id);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function finiteOrNull(value) {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function isSummaryStale(summary, policyHash, engineVersion) {
  if (!summary || !summary.computedAt) return true;
  if (policyHash && summary.policyHash && summary.policyHash !== policyHash) return true;
  if (engineVersion && summary.engineVersion && summary.engineVersion !== engineVersion) return true;
  return false;
}

async function resolvePolicyMeta(course) {
  const { resolved } = await gradingPolicyService.getCourseGradingContext(course);
  const { policyHash } = generateResolvedPolicySnapshot(resolved);
  return {
    resolved,
    policyHash,
    engineVersion: getGradingEngineVersion(),
  };
}

function toStudentSummaryFields(gradeResult, policyHash, engineVersion) {
  const currentPercent = finiteOrNull(gradeResult.currentPercent);
  return {
    currentPercent,
    finalPercent: finiteOrNull(gradeResult.finalPercent),
    totalPercent: currentPercent,
    letterGrade: gradeResult.letterGrade || '',
    finalLetterGrade: gradeResult.finalLetterGrade || '',
    policyHash,
    engineVersion,
    computedAt: new Date(),
  };
}

async function persistStudentSummary(courseId, studentId, fields) {
  return CourseEnrollmentGrade.findOneAndUpdate(
    { course: courseId, student: studentId },
    { $set: fields },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function recomputeAndPersistStudentSummary(courseId, studentId, options = {}) {
  const cid = normalizeId(courseId);
  const sid = normalizeId(studentId);
  const course = options.course || (await Course.findById(cid).lean());
  if (!course) return null;

  const policyMeta = options.policyMeta || (await resolvePolicyMeta(course));
  const assignments =
    options.assignments || (await loadCourseGradeAssignments(cid));
  const policyCache = options.policyCache || new Map();

  const result = await computeStudentCourseGrade(course, sid, {
    audience: 'student',
    assignments,
    policyCache,
    summaryOnly: true,
  });

  const fields = toStudentSummaryFields(result, policyMeta.policyHash, policyMeta.engineVersion);
  await persistStudentSummary(cid, sid, fields);
  return fields;
}

async function recomputeAndPersistCourseClassAverage(courseId, options = {}) {
  const cid = normalizeId(courseId);
  const course =
    options.course ||
    (await Course.findById(cid).select('students dashboardGradeSummary').lean());
  if (!course) return null;

  const policyMeta = options.policyMeta || (await resolvePolicyMeta(course));
  const stored = await CourseEnrollmentGrade.find({ course: cid })
    .select('currentPercent student')
    .lean();

  const enrolledIds = new Set((course.students || []).map(normalizeId));
  const validPercents = stored
    .filter((row) => enrolledIds.has(normalizeId(row.student)))
    .map((row) => row.currentPercent)
    .filter((p) => finiteOrNull(p) !== null);

  const studentCount = enrolledIds.size;
  const gradedCount = validPercents.length;
  const average =
    gradedCount > 0
      ? round2(validPercents.reduce((sum, g) => sum + g, 0) / gradedCount)
      : null;

  const summary = {
    classAverage: average,
    studentCount,
    gradedCount,
    policyHash: policyMeta.policyHash,
    engineVersion: policyMeta.engineVersion,
    computedAt: new Date(),
  };

  await Course.findByIdAndUpdate(cid, { $set: { dashboardGradeSummary: summary } });
  return summary;
}

async function recomputeEntireCourse(courseId) {
  const cid = normalizeId(courseId);
  const course = await Course.findById(cid).lean();
  if (!course) return { studentCount: 0 };

  const policyMeta = await resolvePolicyMeta(course);
  const assignments = await loadCourseGradeAssignments(cid);
  const policyCache = new Map();
  const studentIds = (course.students || []).map(normalizeId);

  await Promise.all(
    studentIds.map((sid) =>
      recomputeAndPersistStudentSummary(cid, sid, {
        course,
        policyMeta,
        assignments,
        policyCache,
      })
    )
  );
  await recomputeAndPersistCourseClassAverage(cid, { course, policyMeta });
  return { studentCount: studentIds.length };
}

function schedule(task) {
  setImmediate(() => {
    Promise.resolve()
      .then(task)
      .catch((err) => {
        console.error('[dashboardGradeSummary] refresh failed', err);
      });
  });
}

async function refreshStudentsAfterGradeChange(courseId, studentIds) {
  const cid = normalizeId(courseId);
  const unique = [...new Set((studentIds || []).map(normalizeId).filter(Boolean))];
  if (!unique.length) return;

  const course = await Course.findById(cid).lean();
  if (!course) return;

  const policyMeta = await resolvePolicyMeta(course);
  const assignments = await loadCourseGradeAssignments(cid);
  const policyCache = new Map();

  await Promise.all(
    unique.map((sid) =>
      recomputeAndPersistStudentSummary(cid, sid, {
        course,
        policyMeta,
        assignments,
        policyCache,
      })
    )
  );
  await recomputeAndPersistCourseClassAverage(cid, { course, policyMeta });
}

function scheduleRefreshStudents(courseId, studentIds) {
  schedule(() => refreshStudentsAfterGradeChange(courseId, studentIds));
}

function scheduleRefreshCourse(courseId) {
  schedule(() => recomputeEntireCourse(courseId));
}

async function removeStudentSummary(courseId, studentId) {
  const cid = normalizeId(courseId);
  const sid = normalizeId(studentId);
  await CourseEnrollmentGrade.deleteOne({ course: cid, student: sid });
  schedule(() => recomputeAndPersistCourseClassAverage(cid));
}

async function readStudentSummariesBatch(studentId, courseIds) {
  const sid = normalizeId(studentId);
  const ids = [...new Set(courseIds.map(normalizeId).filter(Boolean))];
  const grades = {};

  if (!ids.length) return grades;

  const docs = await CourseEnrollmentGrade.find({
    student: sid,
    course: { $in: ids },
  }).lean();

  const docByCourse = new Map(docs.map((doc) => [normalizeId(doc.course), doc]));

  for (const courseId of ids) {
    const doc = docByCourse.get(courseId);
    if (!doc) {
      grades[courseId] = { totalPercent: null, letterGrade: '' };
      continue;
    }
    grades[courseId] = {
      totalPercent: finiteOrNull(doc.currentPercent ?? doc.totalPercent),
      letterGrade: doc.letterGrade || '',
    };
  }

  return grades;
}

async function readClassAveragesBatch(courseIds) {
  const ids = [...new Set(courseIds.map(normalizeId).filter(Boolean))];
  const averages = {};

  if (!ids.length) return averages;

  const courses = await Course.find({ _id: { $in: ids } })
    .select('dashboardGradeSummary')
    .lean();

  const byId = new Map(courses.map((course) => [normalizeId(course._id), course]));

  for (const courseId of ids) {
    const course = byId.get(courseId);
    const summary = course?.dashboardGradeSummary || {};
    averages[courseId] = {
      average: finiteOrNull(summary.classAverage),
      studentCount: summary.studentCount ?? 0,
      gradedCount: summary.gradedCount ?? 0,
    };
  }

  return averages;
}

/**
 * After a dashboard read, backfill any courses missing materialized student summaries.
 */
async function scheduleStaleRefreshesForStudent(studentId, courseIds) {
  const sid = normalizeId(studentId);
  const ids = [...new Set(courseIds.map(normalizeId).filter(Boolean))];
  if (!ids.length) return;

  const docs = await CourseEnrollmentGrade.find({ student: sid, course: { $in: ids } })
    .select('course')
    .lean();
  const haveDoc = new Set(docs.map((doc) => normalizeId(doc.course)));
  const missing = ids.filter((id) => !haveDoc.has(id));

  for (const courseId of missing) {
    schedule(() => refreshStudentsAfterGradeChange(courseId, [sid]));
  }
}

async function scheduleStaleClassAverageRefreshes(courseIds) {
  const ids = [...new Set(courseIds.map(normalizeId).filter(Boolean))];
  if (!ids.length) return;

  const courses = await Course.find({ _id: { $in: ids } })
    .select('dashboardGradeSummary')
    .lean();

  for (const course of courses) {
    const cid = normalizeId(course._id);
    if (!course.dashboardGradeSummary?.computedAt) {
      schedule(() => recomputeEntireCourse(cid));
    }
  }
}

module.exports = {
  normalizeId,
  isSummaryStale,
  recomputeAndPersistStudentSummary,
  recomputeAndPersistCourseClassAverage,
  recomputeEntireCourse,
  refreshStudentsAfterGradeChange,
  scheduleRefreshStudents,
  scheduleRefreshCourse,
  removeStudentSummary,
  readStudentSummariesBatch,
  readClassAveragesBatch,
  scheduleStaleRefreshesForStudent,
  scheduleStaleClassAverageRefreshes,
};
