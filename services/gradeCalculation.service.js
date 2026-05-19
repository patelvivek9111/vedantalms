const {
  calculateFinalGradeWithWeightedGroups,
  getLetterGrade,
  courseContextFromResolvedPolicy,
} = require('../utils/gradeCalculation');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const gradingPolicySnapshotService = require('./gradingPolicySnapshot.service');

/**
 * Single entry point for student course grade % + letter (grades API, transcript, exports).
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
      return {
        totalPercent: frozen.finalPercent,
        letterGrade: frozen.letterGrade,
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

  const { resolved, courseContext, fromStoredSnapshot } =
    await gradingPolicySnapshotService.getGradingContextForCalculation(coursePlain, {
      storedPolicySnapshot: options.storedPolicySnapshot,
      skipInstitution: options.skipInstitution,
      teacherPolicy: options.teacherPolicy,
    });

  const totalPercent = calculateFinalGradeWithWeightedGroups(
    sid,
    courseContext,
    allAssignments,
    grades,
    submissionMap,
    resolved
  );
  const letterGrade = getLetterGrade(totalPercent, courseContext.gradeScale);
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);

  let persistedSnapshot = false;
  if (options.persistTranscriptSnapshot && options.term && options.year) {
    const { created } = await gradingPolicySnapshotService.persistTranscriptSnapshot({
      studentId,
      courseId,
      term: options.term,
      year: options.year,
      finalPercent: totalPercent,
      letterGrade,
      snapshotBundle,
      gradingEngineVersion: engineVersion,
      lifecycleStatus: options.lifecycleStatus || lifecycle?.status || null,
    });
    persistedSnapshot = created;
  }

  return {
    totalPercent,
    letterGrade,
    resolved,
    courseContext,
    fromStoredSnapshot: !!fromStoredSnapshot,
    gradingEngineVersion: engineVersion,
    persistedSnapshot,
    lifecycleStatus: lifecycle?.status,
    ...snapshotBundle,
  };
}

module.exports = {
  calculateCourseGradeForStudent,
};
