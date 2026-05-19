const Course = require('../models/course.model');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
const { canRecomputeGrades } = require('../middleware/academicPermissions');
const gradeLifecycleService = require('./gradeLifecycle.service');
const gradingPolicySnapshotService = require('./gradingPolicySnapshot.service');
const { buildStudentCourseGradeContext } = require('./studentCourseGradeData.service');
const academicAuditService = require('./academicAudit.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');

const FINALIZED_STATUSES = gradeLifecycleService.FINALIZED_STATUSES;

function recomputeError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeStudentId(id) {
  if (id && typeof id === 'object' && id._id) return String(id._id);
  return String(id);
}

function resolveTargetStudentIds(course, studentIds) {
  const enrolled = (course.students || []).map(normalizeStudentId);
  if (!studentIds || studentIds.length === 0) {
    return enrolled;
  }
  const allowed = new Set(enrolled);
  const filtered = studentIds.map(String).filter((id) => allowed.has(id));
  if (filtered.length === 0) {
    throw recomputeError('No matching enrolled students in studentIds filter', 400);
  }
  return filtered;
}

async function computeStudentRecomputeRow(course, studentId, term, year) {
  const { calculateCourseGradeForStudent } = require('./gradeCalculation.service');
  const frozen = await gradingPolicySnapshotService.findFrozenTranscriptSnapshot(
    studentId,
    course._id,
    term,
    year
  );

  const { allAssignments, grades, submissionMap } = await buildStudentCourseGradeContext(
    course,
    studentId
  );

  const live = await calculateCourseGradeForStudent(
    studentId,
    course,
    allAssignments,
    grades,
    submissionMap,
    {
      term,
      year,
      persistTranscriptSnapshot: false,
      ignoreFinalizedGuard: true,
      gradingEngineVersion: getGradingEngineVersion(),
    }
  );

  const oldPercent = frozen?.finalPercent ?? null;
  const oldLetter = frozen?.letterGrade ?? null;
  const oldHash = frozen?.gradingPolicyHash ?? null;
  const newPercent = live.totalPercent;
  const newLetter = live.letterGrade;
  const newHash = live.policyHash;

  const changed =
    !frozen ||
    oldPercent !== newPercent ||
    oldLetter !== newLetter ||
    oldHash !== newHash;

  return {
    studentId: String(studentId),
    hasSnapshot: !!frozen,
    oldPercent,
    oldLetter,
    oldHash,
    oldPolicyVersion: frozen?.gradingPolicyVersion ?? null,
    newPercent,
    newLetter,
    newHash,
    newPolicyVersion: live.policyVersion,
    changed,
  };
}

async function persistRecomputedSnapshots(course, term, year, rows, lifecycleStatus) {
  const { calculateCourseGradeForStudent } = require('./gradeCalculation.service');
  const gradingPolicyService = require('./gradingPolicy.service');
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(
    course.toObject?.() || course
  );
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);
  const engineVersion = getGradingEngineVersion();
  let updatedCount = 0;

  for (const row of rows) {
    if (!row.changed) continue;

    const { allAssignments, grades, submissionMap } = await buildStudentCourseGradeContext(
      course,
      row.studentId
    );

    const gradeResult = await calculateCourseGradeForStudent(
      row.studentId,
      course,
      allAssignments,
      grades,
      submissionMap,
      {
        term,
        year,
        persistTranscriptSnapshot: false,
        ignoreFinalizedGuard: true,
        lifecycleStatus,
        gradingEngineVersion: engineVersion,
      }
    );

    const existing = await gradingPolicySnapshotService.findFrozenTranscriptSnapshot(
      row.studentId,
      course._id,
      term,
      year
    );
    if (existing) {
      await gradingPolicySnapshotService.persistTranscriptSnapshot({
        studentId: row.studentId,
        courseId: course._id,
        term,
        year,
        finalPercent: gradeResult.totalPercent,
        letterGrade: gradeResult.letterGrade,
        snapshotBundle,
        gradingEngineVersion: engineVersion,
        lifecycleStatus,
        allowReplaceCurrent: true,
      });
    } else {
      await gradingPolicySnapshotService.persistTranscriptSnapshot({
        studentId: row.studentId,
        courseId: course._id,
        term,
        year,
        finalPercent: gradeResult.totalPercent,
        letterGrade: gradeResult.letterGrade,
        snapshotBundle,
        gradingEngineVersion: engineVersion,
        lifecycleStatus,
      });
    }
    updatedCount += 1;
  }

  return updatedCount;
}

/**
 * Dry-run or apply transcript grade recompute for a course term.
 */
async function recomputeTranscriptGrades({
  courseId,
  term,
  year,
  studentIds,
  dryRun = true,
  reason,
  forceAmend = false,
  user,
  ip,
}) {
  if (!canRecomputeGrades(user)) {
    throw recomputeError('Not authorized to recompute grades', 403);
  }

  const course = await Course.findById(courseId).lean();
  if (!course) throw recomputeError('Course not found', 404);
  course.students = (course.students || []).map(normalizeStudentId);
  const courseSem = getSemesterFromCourse(course);
  const termResolved = term || courseSem.term;
  const yearResolved = Number(year ?? courseSem.year);

  if (term && term !== courseSem.term) {
    throw recomputeError('Term does not match course semester', 400);
  }
  if (year && Number(year) !== Number(courseSem.year)) {
    throw recomputeError('Year does not match course semester', 400);
  }

  const lifecycle = await gradeLifecycleService.getLifecycle(
    course._id,
    termResolved,
    yearResolved
  );
  const lifecycleStatus = lifecycle?.status || 'DRAFT';
  const isFinalized = lifecycle && FINALIZED_STATUSES.has(lifecycle.status);

  const targets = resolveTargetStudentIds(course, studentIds);
  const affected = [];
  for (const studentId of targets) {
    affected.push(await computeStudentRecomputeRow(course, studentId, termResolved, yearResolved));
  }

  const changedRows = affected.filter((r) => r.changed);
  const warnings = [];
  if (isFinalized && !dryRun && !forceAmend) {
    throw recomputeError(
      'Cannot apply recompute on a finalized term without forceAmend and reason. Use amend workflow or set forceAmend: true.',
      403
    );
  }
  if (isFinalized && forceAmend && studentIds?.length) {
    warnings.push(
      'forceAmend applies a full course amendment; studentIds filter is ignored on finalized terms.'
    );
  }

  if (dryRun) {
    return {
      dryRun: true,
      courseId: String(course._id),
      term: termResolved,
      year: yearResolved,
      lifecycleStatus,
      affected,
      changedCount: changedRows.length,
      unchangedCount: affected.length - changedRows.length,
      warnings,
    };
  }

  if (!reason || String(reason).trim().length < 3) {
    throw recomputeError('reason is required when applying recompute (min 3 characters)', 400);
  }

  if (isFinalized && forceAmend) {
    const amendResult = await gradeLifecycleService.transitionToAmended(course._id, user, {
      reason: String(reason).trim(),
      ip,
    });
    await academicAuditService.recordAuditEvent({
      actorId: user._id,
      entityType: 'course_grade_lifecycle',
      entityId: amendResult.lifecycle._id,
      action: 'transcript_recompute_applied',
      before: { via: 'forceAmend', changedCount: changedRows.length },
      after: { amendmentSequence: amendResult.amendment.sequence },
      severity: 'critical',
      ip,
      metadata: { courseId, term: termResolved, year: yearResolved, dryRun: false },
    });
    return {
      dryRun: false,
      applied: true,
      via: 'forceAmend',
      courseId: String(course._id),
      term: termResolved,
      year: yearResolved,
      lifecycleStatus: amendResult.lifecycle.status,
      affected,
      changedCount: changedRows.length,
      updatedCount: amendResult.frozenCount,
      amendment: amendResult.amendment,
      warnings,
    };
  }

  const updatedCount = await persistRecomputedSnapshots(
    course,
    termResolved,
    yearResolved,
    changedRows,
    lifecycleStatus
  );

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'course_grade_lifecycle',
    entityId: lifecycle?._id || String(course._id),
    action: 'transcript_recompute_applied',
    before: { lifecycleStatus, changedCount: changedRows.length },
    after: { updatedCount, reason: String(reason).trim() },
    severity: 'warning',
    ip,
    metadata: { courseId, term: termResolved, year: yearResolved },
  });

  return {
    dryRun: false,
    applied: true,
    via: 'snapshot_update',
    courseId: String(course._id),
    term: termResolved,
    year: yearResolved,
    lifecycleStatus,
    affected,
    changedCount: changedRows.length,
    updatedCount,
    warnings,
  };
}

module.exports = {
  recomputeTranscriptGrades,
  computeStudentRecomputeRow,
};
