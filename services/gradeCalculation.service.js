const {
  calculateCurrentGradeWithWeightedGroups,
  calculateProjectedFinalGradeWithWeightedGroups,
  getLetterGrade,
  courseContextFromResolvedPolicy,
} = require('../utils/gradeCalculation');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const { enrichResolvedForAssignmentOrder } = require('../shared/grading/policyApplication.cjs');
const gradingPolicySnapshotService = require('./gradingPolicySnapshot.service');
const courseStudentGradeOverrideService = require('./courseStudentGradeOverride.service');
const studentGradeDetailService = require('./studentGradeDetail.service');
const gradingPeriodRollupService = require('./gradingPeriodRollup.service');
const {
  loadCourseGradeAssignments,
  buildStudentGradeInputs,
} = require('./gradeCalculationInputs.service');

/**
 * Compute Canvas-style current + projected final totals for a student course grade.
 */
function computeDualGradeTotals(
  studentId,
  courseContext,
  allAssignments,
  grades,
  submissionMap,
  resolved
) {
  const sid = String(studentId);
  const currentPercent = calculateCurrentGradeWithWeightedGroups(
    sid,
    courseContext,
    allAssignments,
    grades,
    submissionMap,
    resolved
  );
  const finalPercent = calculateProjectedFinalGradeWithWeightedGroups(
    sid,
    courseContext,
    allAssignments,
    grades,
    submissionMap,
    resolved
  );
  const letterGrade = getLetterGrade(currentPercent, courseContext.gradeScale);
  const finalLetterGrade = getLetterGrade(finalPercent, courseContext.gradeScale);

  return {
    currentPercent,
    finalPercent,
    totalPercent: currentPercent,
    letterGrade,
    finalLetterGrade,
  };
}

/**
 * Canonical course grade computation — student API, gradebook totals, exports, transcripts.
 * @param {'instructor'|'student'} [options.audience='student'] — student applies grade-release visibility
 */
async function computeStudentCourseGrade(course, studentId, options = {}) {
  const coursePlain = course?.toObject ? course.toObject() : course;
  const courseId = coursePlain._id || coursePlain.id;
  const sid = String(studentId);
  const audience = options.audience || 'student';

  const assignments =
    options.assignments ||
    (await loadCourseGradeAssignments(courseId, {
      gradingPeriodId: options.gradingPeriodId,
    }));

  const { resolved: rawResolved, courseContext: rawContext, fromStoredSnapshot } =
    await gradingPolicySnapshotService.getGradingContextForCalculation(coursePlain, {
      storedPolicySnapshot: options.storedPolicySnapshot,
      skipInstitution: options.skipInstitution,
      teacherPolicy: options.teacherPolicy,
      policyCache: options.policyCache,
    });

  let { allAssignments, grades, submissionMap } = options;
  if (!allAssignments || !grades || !submissionMap) {
    const built = await buildStudentGradeInputs(coursePlain, sid, assignments, audience, {
      resolved: rawResolved,
    });
    allAssignments = built.allAssignments;
    grades = built.grades;
    submissionMap = built.submissionMap;
  }

  const resolved = enrichResolvedForAssignmentOrder(rawResolved, allAssignments);
  const courseContext =
    resolved === rawResolved ? rawContext : courseContextFromResolvedPolicy(resolved);

  let dualTotals = computeDualGradeTotals(
    sid,
    courseContext,
    allAssignments,
    grades,
    submissionMap,
    resolved
  );

  let gradingPeriodBreakdown = null;

  // Canvas: when viewing all periods and periods are weighted, course total = weighted period average.
  if (!options.gradingPeriodId && !options.skipPeriodRollup) {
    const periods = await gradingPeriodRollupService.listCoursePeriods(courseId);
    if (gradingPeriodRollupService.shouldUseWeightedRollup(periods)) {
      const rollup = await gradingPeriodRollupService.rollupWeightedPeriodGrades(
        coursePlain,
        sid,
        periods,
        (periodId) =>
          computeStudentCourseGrade(coursePlain, sid, {
            ...options,
            gradingPeriodId: periodId,
            skipPeriodRollup: true,
            assignments: undefined,
            allAssignments: undefined,
            grades: undefined,
            submissionMap: undefined,
          })
      );
      if (rollup) {
        dualTotals = {
          ...dualTotals,
          currentPercent: rollup.currentPercent,
          finalPercent: rollup.finalPercent,
          totalPercent: rollup.totalPercent,
          letterGrade: rollup.letterGrade,
          finalLetterGrade: rollup.finalLetterGrade,
        };
        gradingPeriodBreakdown = rollup.gradingPeriodBreakdown;
      }
    }
  }

  const override = await courseStudentGradeOverrideService.getActiveOverride(courseId, sid);
  if (override) {
    dualTotals = {
      ...dualTotals,
      finalPercent: override.finalPercent,
      finalLetterGrade:
        override.letterGrade ||
        getLetterGrade(override.finalPercent, courseContext.gradeScale),
      gradeOverride: {
        finalPercent: override.finalPercent,
        letterGrade: override.letterGrade,
        reason: override.reason,
        overriddenAt: override.updatedAt || override.createdAt,
      },
    };
  }

  if (options.summaryOnly) {
    return {
      ...dualTotals,
      studentId: sid,
      audience,
      ...(gradingPeriodBreakdown ? { gradingPeriodBreakdown } : {}),
    };
  }

  const assignmentGroups = studentGradeDetailService.buildAssignmentGroupBreakdown(
    sid,
    courseContext,
    allAssignments,
    grades,
    submissionMap,
    resolved
  );
  const unpostedCount =
    audience === 'student'
      ? studentGradeDetailService.countUnpostedAssignments(
          allAssignments,
          grades,
          submissionMap,
          sid
        )
      : 0;
  const policyMeta = studentGradeDetailService.buildPolicyMeta(resolved, {
    gradingEngineVersion: options.gradingEngineVersion || getGradingEngineVersion(),
  });
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);

  return {
    ...dualTotals,
    studentId: sid,
    audience,
    allAssignments,
    grades,
    submissionMap,
    resolved,
    courseContext,
    assignmentGroups,
    unpostedCount,
    policyMeta,
    fromStoredSnapshot: !!fromStoredSnapshot,
    gradingEngineVersion: options.gradingEngineVersion || getGradingEngineVersion(),
    gradingPeriodBreakdown,
    ...snapshotBundle,
  };
}

/**
 * Public API shape for GET /api/grades/student/course/:courseId
 * totalPercent remains an alias for currentPercent (backwards compatible).
 */
function toStudentGradeApiResponse(gradeResult, options = {}) {
  const payload = {
    currentPercent: gradeResult.currentPercent,
    finalPercent: gradeResult.finalPercent,
    totalPercent: gradeResult.totalPercent,
    letterGrade: gradeResult.letterGrade,
    finalLetterGrade: gradeResult.finalLetterGrade,
    fromFrozenSnapshot: !!gradeResult.fromFrozenSnapshot,
  };

  if (options.extended !== false) {
    payload.assignmentGroups = gradeResult.assignmentGroups || [];
    payload.unpostedCount = gradeResult.unpostedCount ?? 0;
    payload.policyMeta = gradeResult.policyMeta || null;
    if (gradeResult.gradeOverride) {
      payload.gradeOverride = gradeResult.gradeOverride;
    }
    if (gradeResult.gradingPeriodBreakdown) {
      payload.gradingPeriodBreakdown = gradeResult.gradingPeriodBreakdown;
    }
  }

  return payload;
}

/**
 * Student course grade with lifecycle / transcript guards. Delegates to computeStudentCourseGrade.
 */
async function calculateCourseGradeForStudent(
  studentId,
  course,
  allAssignments,
  grades,
  submissionMap,
  options = {}
) {
  const coursePlain = course?.toObject ? course.toObject() : course;
  const courseId = coursePlain._id || coursePlain.id;
  const sid = String(studentId);
  const engineVersion = options.gradingEngineVersion || getGradingEngineVersion();

  const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');
  const FINALIZED_STATUSES = new Set(['FINALIZED', 'AMENDED']);

  const lifecycle =
    options.term && options.year
      ? await CourseGradeLifecycle.findOne({
          course: courseId,
          term: options.term,
          year: Number(options.year),
        }).lean()
      : null;

  const isFinalized =
    !options.ignoreFinalizedGuard &&
    lifecycle &&
    FINALIZED_STATUSES.has(lifecycle.status);

  if (
    (options.useFrozenTranscriptSnapshot || isFinalized) &&
    options.term &&
    options.year
  ) {
    const frozen = await gradingPolicySnapshotService.findFrozenTranscriptSnapshot(
      studentId,
      courseId,
      options.term,
      options.year
    );
    if (frozen) {
      const resolved = frozen.gradingPolicySnapshot;
      const officialPercent = frozen.finalPercent;
      const officialLetter = frozen.letterGrade;
      return {
        currentPercent: officialPercent,
        finalPercent: officialPercent,
        totalPercent: officialPercent,
        letterGrade: officialLetter,
        finalLetterGrade: officialLetter,
        resolved,
        courseContext: courseContextFromResolvedPolicy(resolved),
        policyVersion: frozen.gradingPolicyVersion,
        policyHash: frozen.gradingPolicyHash,
        gradingEngineVersion: frozen.gradingEngineVersion || engineVersion,
        resolvedPolicySnapshot: frozen.gradingPolicySnapshot,
        fromFrozenSnapshot: true,
        lifecycleStatus: frozen.lifecycleStatus || lifecycle?.status,
      };
    }
    if (isFinalized) {
      const err = new Error(
        'Finalized course term has no frozen grade snapshot for this student. Contact registrar.'
      );
      err.statusCode = 409;
      throw err;
    }
  }

  const hasPrebuilt =
    allAssignments != null && grades != null && submissionMap != null;

  const result = await computeStudentCourseGrade(coursePlain, sid, {
    audience: 'student',
    gradingEngineVersion: engineVersion,
    storedPolicySnapshot: options.storedPolicySnapshot,
    skipInstitution: options.skipInstitution,
    teacherPolicy: options.teacherPolicy,
    policyCache: options.policyCache,
    gradingPeriodId: options.gradingPeriodId,
    summaryOnly: options.summaryOnly,
    ...(hasPrebuilt ? { allAssignments, grades, submissionMap } : {}),
  });

  let persistedSnapshot = false;
  if (options.persistTranscriptSnapshot && options.term && options.year) {
    const snapshotBundle = generateResolvedPolicySnapshot(result.resolved);
    const { created } = await gradingPolicySnapshotService.persistTranscriptSnapshot({
      studentId,
      courseId,
      term: options.term,
      year: options.year,
      finalPercent: result.totalPercent,
      letterGrade: result.letterGrade,
      snapshotBundle,
      gradingEngineVersion: engineVersion,
      lifecycleStatus: options.lifecycleStatus || lifecycle?.status || null,
    });
    persistedSnapshot = created;
  }

  return {
    ...result,
    persistedSnapshot,
    lifecycleStatus: lifecycle?.status,
  };
}

module.exports = {
  computeDualGradeTotals,
  computeStudentCourseGrade,
  toStudentGradeApiResponse,
  calculateCourseGradeForStudent,
};
