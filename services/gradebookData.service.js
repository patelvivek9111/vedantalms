/**
 * Instructor gradebook data: assignment columns, per-student grades, and
 * server-computed totals via the canonical computeStudentCourseGrade path.
 */
const Course = require('../models/course.model');
const gradingPolicyService = require('./gradingPolicy.service');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const { resolveAssignmentWorkflowState } = require('./assignmentWorkflow.service');
const { mapUsersWithResolvedProfilePictures } = require('../utils/profilePictureUrl');
const { computeStudentCourseGrade } = require('./gradeCalculation.service');
const gradebookHistoryService = require('./gradebookHistory.service');
const {
  loadCourseGradeAssignments,
  buildStudentGradeInputs,
} = require('./gradeCalculationInputs.service');
const { listActiveStudentIds } = require('./registrar/rosterRead.service');
const User = require('../models/user.model');

function normalizeStudentId(id) {
  if (id && typeof id === 'object' && id._id) return String(id._id);
  return String(id);
}

async function resolveRosterStudentIds(course) {
  const ids = await listActiveStudentIds(course._id, { rootAccountId: course.rootAccountId });
  return (ids || []).map(normalizeStudentId);
}

function buildPolicyMeta(resolved, snapshotBundle) {
  return {
    policyHash: snapshotBundle.policyHash,
    policyVersion: snapshotBundle.policyVersion,
    gradingEngineVersion: getGradingEngineVersion(),
    missingAssignmentMode: resolved.missingAssignment?.mode || 'count_as_zero',
    applyMode: resolved.policyApplication?.applyMode || 'retroactive_all',
    hasLegacyPolicy: Boolean(resolved.policyApplication?.legacyPolicy),
  };
}

/** Delegates to shared assignment catalog (modules, group assignments, graded discussions). */
async function loadGradebookColumns(courseId, options = {}) {
  return loadCourseGradeAssignments(courseId, options);
}

/**
 * Build grades map for many students (export / full dataset).
 * Optionally fills flattened submissionMap (`${studentId}_${assignmentId}`) and cellMeta.
 */
async function buildGradebookGrades(
  course,
  assignments,
  studentIds,
  policyCache,
  submissionMapOut = null,
  cellMetaOut = null
) {
  const grades = {};

  for (const sid of studentIds) {
    const inputs = await buildStudentGradeInputs(course, sid, assignments, 'instructor');
    grades[sid] = inputs.grades[sid] || {};

    if (submissionMapOut) {
      for (const [assignmentId, sub] of Object.entries(inputs.submissionMap || {})) {
        submissionMapOut[`${sid}_${assignmentId}`] = String(sub._id);
      }
    }

    if (cellMetaOut) {
      cellMetaOut[sid] = {};
      for (const assignment of inputs.allAssignments || []) {
        const assignmentId = String(assignment._id);
        const sub = inputs.submissionMap?.[assignmentId];
        if (sub) {
          cellMetaOut[sid][assignmentId] = {
            submissionId: String(sub._id),
            status: resolveAssignmentWorkflowState({ assignment, submission: sub }),
            gradesReleasedAt: sub.gradesReleasedAt || null,
            gradeHidden: sub.gradeHidden === true,
            feedbackReleasedAt: sub.feedbackReleasedAt || null,
            attemptStatus: sub.attemptStatus || null,
            hasSubmitted: true,
          };
        } else if (assignment.isDiscussion) {
          cellMetaOut[sid][assignmentId] = {
            hasSubmitted: assignment.hasSubmitted === true,
          };
        }
      }
    }
  }

  return grades;
}

/**
 * Class average for dashboard (same canonical path as student course grade API).
 */
async function computeCourseClassAverage(courseId) {
  const course = await Course.findById(courseId).lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }

  const studentIds = await resolveRosterStudentIds(course);
  if (studentIds.length === 0) {
    return { average: null, studentCount: 0, gradedCount: 0 };
  }

  const assignments = await loadGradebookColumns(courseId);
  const policyCache = new Map();

  const percentResults = await Promise.all(
    studentIds.map(async (sid) => {
      try {
        const result = await computeStudentCourseGrade(course, sid, {
          audience: 'student',
          assignments,
          policyCache,
          summaryOnly: true,
        });
        return Number.isFinite(result.currentPercent) ? result.currentPercent : null;
      } catch {
        return null;
      }
    })
  );

  const studentGrades = percentResults.filter((value) => value !== null);

  const gradedCount = studentGrades.length;
  const average =
    gradedCount > 0
      ? Math.round((studentGrades.reduce((sum, g) => sum + g, 0) / gradedCount) * 100) / 100
      : null;

  return {
    average,
    studentCount: studentIds.length,
    gradedCount,
  };
}

/** Batch wrapper for dashboard oversight pages. */
async function computeCourseClassAverages(courseIds) {
  const out = {};
  await Promise.all(
    (courseIds || []).map(async (courseId) => {
      const id = String(courseId);
      try {
        out[id] = await computeCourseClassAverage(id);
      } catch (err) {
        out[id] = {
          error: err.message,
          average: null,
          studentCount: 0,
          gradedCount: 0,
        };
      }
    })
  );
  return out;
}

async function getCourseGradebookPage(
  courseId,
  { page = 1, pageSize = 50, policyCache, gradingPeriodId } = {}
) {
  const course = await Course.findById(courseId)
    .populate('instructor', 'firstName lastName email')
    .lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }

  const cache = policyCache || new Map();
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(course, {
    policyCache: cache,
  });
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);

  const studentIds = await resolveRosterStudentIds(course);
  const rosterUsers = studentIds.length
    ? await User.find({ _id: { $in: studentIds } })
        .select('firstName lastName email profilePicture')
        .lean()
    : [];
  const byId = new Map(rosterUsers.map((u) => [String(u._id), u]));
  const orderedStudents = studentIds.map((id) => byId.get(String(id)) || { _id: id });

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePageSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));
  const start = (safePage - 1) * safePageSize;
  const pageStudentIds = studentIds.slice(start, start + safePageSize);

  const columnOptions = gradingPeriodId ? { gradingPeriodId } : {};
  const assignments = await loadGradebookColumns(courseId, columnOptions);

  const submissionMap = {};
  const cellMeta = {};
  const grades = {};
  const studentTotals = {};
  const releasedTotals = {};
  const instructorTotals = {};
  const studentFinalTotals = {};
  const gradeOverrides = {};

  const gradeOptions = {
    assignments,
    policyCache: cache,
    ...(gradingPeriodId ? { gradingPeriodId } : {}),
  };

  for (const sid of pageStudentIds) {
    const instructorResult = await computeStudentCourseGrade(course, sid, {
      ...gradeOptions,
      audience: 'instructor',
    });

    grades[sid] = instructorResult.grades[sid] || {};

    for (const [assignmentId, sub] of Object.entries(instructorResult.submissionMap || {})) {
      submissionMap[`${sid}_${assignmentId}`] = String(sub._id);
    }

    cellMeta[sid] = {};
    for (const assignment of instructorResult.allAssignments || []) {
      const assignmentId = String(assignment._id);
      const sub = instructorResult.submissionMap?.[assignmentId];
      if (sub) {
        cellMeta[sid][assignmentId] = {
          submissionId: String(sub._id),
          status: resolveAssignmentWorkflowState({ assignment, submission: sub }),
          gradesReleasedAt: sub.gradesReleasedAt || null,
          gradeHidden: sub.gradeHidden === true,
          feedbackReleasedAt: sub.feedbackReleasedAt || null,
          attemptStatus: sub.attemptStatus || null,
          hasSubmitted: true,
        };
      } else if (assignment.isDiscussion) {
        cellMeta[sid][assignmentId] = {
          hasSubmitted: assignment.hasSubmitted === true,
        };
      }
    }

    const studentResult = await computeStudentCourseGrade(course, sid, {
      ...gradeOptions,
      audience: 'student',
    });

    if (Number.isFinite(studentResult.currentPercent)) {
      const rounded = Math.round(studentResult.currentPercent * 100) / 100;
      studentTotals[sid] = rounded;
      releasedTotals[sid] = rounded;
    }

    if (Number.isFinite(instructorResult.currentPercent)) {
      instructorTotals[sid] = Math.round(instructorResult.currentPercent * 100) / 100;
    }

    if (instructorResult.gradeOverride?.finalPercent != null) {
      gradeOverrides[sid] = instructorResult.gradeOverride;
      studentFinalTotals[sid] = instructorResult.gradeOverride.finalPercent;
    } else if (Number.isFinite(studentResult.finalPercent)) {
      studentFinalTotals[sid] = Math.round(studentResult.finalPercent * 100) / 100;
    }
  }

  const assignmentIds = assignments.map((a) => String(a._id));
  const historyCells = await gradebookHistoryService.batchCellsWithHistory(
    courseId,
    pageStudentIds,
    assignmentIds
  );
  for (const sid of pageStudentIds) {
    const sidStr = String(sid);
    if (!cellMeta[sidStr]) cellMeta[sidStr] = {};
    for (const aid of assignmentIds) {
      if (!historyCells.has(gradebookHistoryService.cellHistoryKey(sidStr, aid))) continue;
      if (!cellMeta[sidStr][aid]) cellMeta[sidStr][aid] = {};
      cellMeta[sidStr][aid].hasHistory = true;
    }
  }

  const students = await mapUsersWithResolvedProfilePictures(
    orderedStudents.filter((s) => pageStudentIds.includes(String(s._id)))
  );

  return {
    course: {
      _id: course._id,
      title: course.title,
      instructor: course.instructor,
      groups: course.groups,
      gradeScale: course.gradeScale,
    },
    students,
    assignments,
    grades,
    submissionMap,
    cellMeta,
    studentTotals,
    releasedTotals,
    instructorTotals,
    studentFinalTotals,
    gradeOverrides,
    policyMeta: buildPolicyMeta(resolved, snapshotBundle),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalStudents: studentIds.length,
      totalPages: Math.max(1, Math.ceil(studentIds.length / safePageSize)),
    },
  };
}

async function getFullGradebookDataset(courseId, policyCache, options = {}) {
  const course = await Course.findById(courseId).lean();
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    throw err;
  }

  const cache = policyCache || new Map();
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(course, {
    policyCache: cache,
  });
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);

  const columnOptions = options.gradingPeriodId ? { gradingPeriodId: options.gradingPeriodId } : {};
  const assignments = await loadGradebookColumns(courseId, columnOptions);
  const studentIds = await resolveRosterStudentIds(course);
  const submissionMap = {};
  const grades =
    studentIds.length > 0
      ? await buildGradebookGrades(course, assignments, studentIds, cache, submissionMap)
      : {};

  const rosterUsers = studentIds.length
    ? await User.find({ _id: { $in: studentIds } })
        .select('firstName lastName email profilePicture')
        .lean()
    : [];
  const byId = new Map(rosterUsers.map((u) => [String(u._id), u]));
  const students = await mapUsersWithResolvedProfilePictures(
    studentIds.map((id) => byId.get(String(id)) || { _id: id })
  );

  return {
    course,
    students,
    assignments,
    grades,
    submissionMap,
    policyMeta: buildPolicyMeta(resolved, snapshotBundle),
  };
}

module.exports = {
  loadGradebookColumns,
  buildGradebookGrades,
  computeCourseClassAverage,
  computeCourseClassAverages,
  getCourseGradebookPage,
  getFullGradebookDataset,
  normalizeStudentId,
};
