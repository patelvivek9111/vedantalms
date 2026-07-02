const Course = require('../models/course.model');
const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');
const GradeAmendmentRecord = require('../models/gradeAmendmentRecord.model');
const StudentCourseGradeSnapshot = require('../models/studentCourseGradeSnapshot.model');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const { generateResolvedPolicySnapshot } = require('../shared/grading/policySnapshot.cjs');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const { buildStudentCourseGradeContext } = require('./studentCourseGradeData.service');
const gradingPolicySnapshotService = require('./gradingPolicySnapshot.service');
const {
  canPostGrades,
  canFinalizeGrades,
  canAmendGrades,
} = require('../middleware/academicPermissions');
const academicAuditService = require('./academicAudit.service');
const {
  notifyGradesPosted,
  notifyGradesFinalized,
  notifyGradesAmended,
} = require('./notification/academicNotificationProducers.service');
const crypto = require('crypto');

const FINALIZED_STATUSES = new Set(['FINALIZED', 'AMENDED']);

function lifecycleError(message, statusCode = 403) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function getLifecycle(courseId, term, year) {
  return CourseGradeLifecycle.findOne({
    course: courseId,
    term,
    year: Number(year),
  }).lean();
}

async function getOrCreateLifecycle(course, options = {}) {
  const { term, year } =
    options.term && options.year
      ? { term: options.term, year: Number(options.year) }
      : getSemesterFromCourse(course);

  let doc = await CourseGradeLifecycle.findOne({ course: course._id, term, year: Number(year) });
  if (!doc) {
    doc = await CourseGradeLifecycle.create({
      course: course._id,
      term,
      year: Number(year),
      status: 'DRAFT',
    });
  }
  return doc;
}

async function assertCanEditGrades(courseId, term, year, options = {}) {
  const lifecycle = await getLifecycle(courseId, term, year);
  if (lifecycle && FINALIZED_STATUSES.has(lifecycle.status)) {
    throw lifecycleError(
      'Grades are finalized for this course term. Use registrar amendment flow to change records.'
    );
  }
  if (lifecycle?.status === 'POSTED' && options.auditContext) {
    let lifecycleId = lifecycle._id;
    if (!lifecycleId) {
      const course = await Course.findById(courseId);
      const doc = await getOrCreateLifecycle(course);
      lifecycleId = doc._id;
    }
    await academicAuditService.recordAuditEvent({
      actorId: options.auditContext.actorId,
      entityType: 'course_grade_lifecycle',
      entityId: lifecycleId,
      action: 'grade_edit_while_posted',
      before: { status: 'POSTED' },
      after: options.auditContext.after,
      severity: 'warning',
      ip: options.auditContext.ip,
      metadata: options.auditContext.metadata,
    });
  }
  return lifecycle;
}

async function assertCanMutateCoursePolicy(courseId) {
  const finalized = await CourseGradeLifecycle.findOne({
    course: courseId,
    status: { $in: ['FINALIZED', 'AMENDED'] },
  }).lean();
  if (finalized) {
    throw lifecycleError(
      'Course has finalized grade records. Policy changes cannot affect finalized terms; use amendment workflow.'
    );
  }
}

async function transitionToPosted(courseId, user, courseDoc) {
  const course = courseDoc || (await Course.findById(courseId));
  if (!course) throw lifecycleError('Course not found', 404);
  if (!canPostGrades(user, course)) {
    throw lifecycleError('Not authorized to post grades for this course');
  }

  const { term, year } = getSemesterFromCourse(course);
  const lifecycle = await getOrCreateLifecycle(course);

  if (FINALIZED_STATUSES.has(lifecycle.status)) {
    throw lifecycleError('Cannot post grades: course term is already finalized.');
  }

  const alreadyPosted = lifecycle.status === 'POSTED';
  const before = { status: lifecycle.status };
  lifecycle.status = 'POSTED';
  lifecycle.postedAt = new Date();
  lifecycle.postedBy = user._id;
  await lifecycle.save();

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'course_grade_lifecycle',
    entityId: lifecycle._id,
    action: 'lifecycle_posted',
    before,
    after: { status: 'POSTED', term, year },
    severity: 'info',
  });

  if (!alreadyPosted) {
    await notifyGradesPosted({ course, actor: user }).catch((err) =>
      console.error('grades.posted notification error:', err)
    );
  }

  return lifecycle.toObject();
}

async function batchFreezeCourseGrades(
  course,
  term,
  year,
  lifecycleStatus = 'FINALIZED',
  { amendmentSequence = 0, amendmentRecord = null, allowReplaceCurrent = false, policyCache } = {}
) {
  const { calculateCourseGradeForStudent } = require('./gradeCalculation.service');
  const students = (course.students || []).map((id) =>
    id && typeof id === 'object' && id._id ? id._id : id
  );
  const engineVersion = getGradingEngineVersion();
  const cache = policyCache || new Map();
  let frozenCount = 0;
  const summary = [];

  for (const studentId of students) {
    const beforeSnap = await gradingPolicySnapshotService.findFrozenTranscriptSnapshot(
      studentId,
      course._id,
      term,
      year
    );

    const { allAssignments, grades, submissionMap } = await buildStudentCourseGradeContext(
      course,
      studentId
    );

    const gradeResult = await calculateCourseGradeForStudent(
      studentId,
      course,
      allAssignments,
      grades,
      submissionMap,
      {
        term,
        year,
        persistTranscriptSnapshot: false,
        lifecycleStatus,
        gradingEngineVersion: engineVersion,
        ignoreFinalizedGuard: true,
      }
    );

    const gradingPolicyService = require('./gradingPolicy.service');
    const resolved = await gradingPolicyService.getResolvedPolicyForCourse(
      course.toObject?.() || course,
      { policyCache: cache }
    );
    const snapshotBundle = generateResolvedPolicySnapshot(resolved);

    const { created } = await gradingPolicySnapshotService.persistTranscriptSnapshot({
      studentId,
      courseId: course._id,
      term,
      year,
      finalPercent: gradeResult.totalPercent,
      letterGrade: gradeResult.letterGrade,
      snapshotBundle,
      gradingEngineVersion: engineVersion,
      lifecycleStatus,
      amendmentSequence,
      amendmentRecord,
      allowReplaceCurrent,
    });

    if (created || allowReplaceCurrent) {
      frozenCount += 1;
      summary.push({
        student: studentId,
        beforePercent: beforeSnap?.finalPercent,
        beforeLetter: beforeSnap?.letterGrade,
        afterPercent: gradeResult.totalPercent,
        afterLetter: gradeResult.letterGrade,
      });
    }
  }

  return { frozenCount, summary };
}

async function transitionToFinalized(courseId, user) {
  if (!canFinalizeGrades(user)) {
    throw lifecycleError('Not authorized to finalize grades');
  }

  const distributedLock = require('./distributedLock.service');
  const lockKey = `lifecycle:finalize:${courseId}`;

  return distributedLock.withLock(lockKey, async () => {
  const course = await Course.findById(courseId).populate('students');
  if (!course) throw lifecycleError('Course not found', 404);

  const { term, year } = getSemesterFromCourse(course);
  const lifecycle = await getOrCreateLifecycle(course);

  if (lifecycle.status === 'FINALIZED') {
    return {
      lifecycle: lifecycle.toObject(),
      frozenCount: lifecycle.studentSnapshotCount || 0,
      policyHash: lifecycle.policyHash,
      policyVersion: lifecycle.policyVersion,
      gradingEngineVersion: lifecycle.gradingEngineVersion,
      idempotent: true,
    };
  }

  const gradingPolicyService = require('./gradingPolicy.service');
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(course.toObject?.() || course);
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);
  const batchId = crypto.randomBytes(12).toString('hex');

  const { frozenCount } = await batchFreezeCourseGrades(course, term, year, 'FINALIZED');

  const before = {
    status: lifecycle.status,
    policyHash: lifecycle.policyHash,
  };
  lifecycle.status = 'FINALIZED';
  lifecycle.finalizedAt = new Date();
  lifecycle.finalizedBy = user._id;
  lifecycle.policyHash = snapshotBundle.policyHash;
  lifecycle.policyVersion = snapshotBundle.policyVersion;
  lifecycle.gradingEngineVersion = getGradingEngineVersion();
  lifecycle.transcriptSnapshotBatchId = batchId;
  lifecycle.studentSnapshotCount = frozenCount;
  await lifecycle.save();

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'course_grade_lifecycle',
    entityId: lifecycle._id,
    action: 'lifecycle_finalized',
    before,
    after: {
      status: 'FINALIZED',
      policyHash: lifecycle.policyHash,
      frozenCount,
    },
    severity: 'critical',
  });

  notifyGradesFinalized({ course, actor: user }).catch((err) =>
    console.error('grades.finalized notification error:', err)
  );

  return {
    lifecycle: lifecycle.toObject(),
    frozenCount,
    policyHash: snapshotBundle.policyHash,
    policyVersion: snapshotBundle.policyVersion,
    gradingEngineVersion: lifecycle.gradingEngineVersion,
    idempotent: false,
  };
  }, 180000);
}

async function transitionToAmended(courseId, user, { reason, ip } = {}) {
  if (!canAmendGrades(user)) {
    throw lifecycleError('Not authorized to amend finalized grades');
  }
  if (!reason || String(reason).trim().length < 3) {
    throw lifecycleError('Amendment reason is required', 400);
  }

  const course = await Course.findById(courseId).populate('students');
  if (!course) throw lifecycleError('Course not found', 404);

  const { term, year } = getSemesterFromCourse(course);
  const lifecycle = await getOrCreateLifecycle(course);

  if (lifecycle.status !== 'FINALIZED') {
    throw lifecycleError('Amendment requires a finalized course term.', 400);
  }

  const beforePolicyHash = lifecycle.policyHash;
  const beforePolicyVersion = lifecycle.policyVersion;
  const beforeEngineVersion = lifecycle.gradingEngineVersion;
  const beforeStatus = lifecycle.status;

  const lastAmend = await GradeAmendmentRecord.findOne({ course: courseId, term, year })
    .sort({ sequence: -1 })
    .lean();
  const sequence = (lastAmend?.sequence || 0) + 1;

  await gradingPolicySnapshotService.supersedeCurrentSnapshots(course._id, term, year);

  const { frozenCount, summary } = await batchFreezeCourseGrades(course, term, year, 'FINALIZED', {
    amendmentSequence: sequence,
    amendmentRecord: null,
    allowReplaceCurrent: true,
  });

  const gradingPolicyService = require('./gradingPolicy.service');
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(course.toObject?.() || course);
  const snapshotBundle = generateResolvedPolicySnapshot(resolved);

  const amendment = await GradeAmendmentRecord.create({
    course: course._id,
    term,
    year,
    lifecycle: lifecycle._id,
    amendedBy: user._id,
    reason: String(reason).trim(),
    sequence,
    beforePolicyHash,
    afterPolicyHash: snapshotBundle.policyHash,
    beforePolicyVersion,
    afterPolicyVersion: snapshotBundle.policyVersion,
    beforeGradingEngineVersion: beforeEngineVersion,
    afterGradingEngineVersion: getGradingEngineVersion(),
    beforeLifecycleStatus: beforeStatus,
    studentCount: frozenCount,
    snapshotSummary: summary,
  });

  await StudentCourseGradeSnapshot.updateMany(
    {
      course: course._id,
      term,
      year,
      isCurrent: true,
      amendmentRecord: { $exists: false },
    },
    { $set: { amendmentRecord: amendment._id } }
  );

  lifecycle.status = 'FINALIZED';
  lifecycle.amendedFrom = lifecycle._id;
  lifecycle.amendmentReason = String(reason).trim();
  lifecycle.policyHash = snapshotBundle.policyHash;
  lifecycle.policyVersion = snapshotBundle.policyVersion;
  lifecycle.gradingEngineVersion = getGradingEngineVersion();
  lifecycle.studentSnapshotCount = frozenCount;
  await lifecycle.save();

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'grade_amendment',
    entityId: amendment._id,
    action: 'grades_amended',
    before: {
      policyHash: beforePolicyHash,
      policyVersion: beforePolicyVersion,
    },
    after: {
      policyHash: snapshotBundle.policyHash,
      policyVersion: snapshotBundle.policyVersion,
      sequence,
    },
    severity: 'critical',
    ip,
    metadata: { courseId, term, year, frozenCount },
  });

  const affectedStudentIds = (summary || [])
    .filter(
      (row) =>
        row.beforePercent !== row.afterPercent || row.beforeLetter !== row.afterLetter
    )
    .map((row) => row.student);

  if (affectedStudentIds.length) {
    notifyGradesAmended({
      course,
      studentIds: affectedStudentIds,
      actor: user,
      reason,
      amendmentSequence: sequence,
    }).catch((err) => console.error('grades.amended notification error:', err));
  }

  return {
    amendment: amendment.toObject(),
    lifecycle: lifecycle.toObject(),
    frozenCount,
    policyHash: snapshotBundle.policyHash,
  };
}

async function listAmendments(courseId, term, year) {
  return GradeAmendmentRecord.find({ course: courseId, term, year: Number(year) })
    .sort({ sequence: -1 })
    .populate('amendedBy', 'firstName lastName email role')
    .lean();
}

module.exports = {
  getLifecycle,
  getOrCreateLifecycle,
  assertCanEditGrades,
  assertCanMutateCoursePolicy,
  transitionToPosted,
  transitionToFinalized,
  transitionToAmended,
  batchFreezeCourseGrades,
  listAmendments,
  FINALIZED_STATUSES,
};
