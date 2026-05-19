const Assignment = require('../models/Assignment');
const Module = require('../models/module.model');
const StudentCourseGradeSnapshot = require('../models/studentCourseGradeSnapshot.model');
const {
  generateResolvedPolicySnapshot,
  resolvedPolicyFromSnapshot,
} = require('../shared/grading/policySnapshot.cjs');
const { courseContextFromResolvedPolicy } = require('../shared/grading/policyResolver.cjs');
const { getGradingEngineVersion } = require('../shared/grading/gradingEngineVersion.cjs');
const gradingPolicyService = require('./gradingPolicy.service');

async function buildSnapshotForCourse(course) {
  const resolved = await gradingPolicyService.getResolvedPolicyForCourse(course);
  return { resolved, ...generateResolvedPolicySnapshot(resolved) };
}

function applySnapshotToDocument(doc, snapshotBundle, engineVersion) {
  const version = engineVersion || getGradingEngineVersion();
  doc.gradingPolicyVersion = snapshotBundle.policyVersion;
  doc.gradingPolicyHash = snapshotBundle.policyHash;
  doc.gradingPolicySnapshot = snapshotBundle.resolvedPolicySnapshot;
  doc.gradingEngineVersion = version;
}

async function getCourseForAssignment(assignmentId) {
  const assignment = await Assignment.findById(assignmentId).select('module').lean();
  if (!assignment?.module) return null;
  const mod = await Module.findById(assignment.module).select('course').populate('course').lean();
  return mod?.course || null;
}

async function stampSubmissionPolicySnapshot(submission) {
  if (!submission?.assignment) return null;
  const course = await getCourseForAssignment(submission.assignment);
  if (!course) return null;
  const bundle = await buildSnapshotForCourse(course);
  applySnapshotToDocument(submission, bundle);
  return bundle;
}

/**
 * Current frozen transcript row for student/course/term.
 */
async function findFrozenTranscriptSnapshot(studentId, courseId, term, year) {
  return StudentCourseGradeSnapshot.findOne({
    student: studentId,
    course: courseId,
    term,
    year: Number(year),
    frozen: true,
    isCurrent: true,
  }).lean();
}

async function findCurrentSnapshotsForCourse(courseId, term, year) {
  return StudentCourseGradeSnapshot.find({
    course: courseId,
    term,
    year: Number(year),
    isCurrent: true,
    frozen: true,
  }).lean();
}

/**
 * Mark current snapshots superseded (amendment); does not delete historical rows.
 */
async function supersedeCurrentSnapshots(courseId, term, year) {
  const now = new Date();
  await StudentCourseGradeSnapshot.updateMany(
    { course: courseId, term, year: Number(year), isCurrent: true },
    { $set: { isCurrent: false, supersededAt: now } }
  );
}

/**
 * Persist a new current frozen snapshot (after finalize or amend).
 */
async function persistTranscriptSnapshot({
  studentId,
  courseId,
  term,
  year,
  finalPercent,
  letterGrade,
  snapshotBundle,
  gradingEngineVersion,
  lifecycleStatus,
  amendmentSequence = 0,
  amendmentRecord = null,
  allowReplaceCurrent = false,
}) {
  const engineVer = gradingEngineVersion || getGradingEngineVersion();
  const existing = await findFrozenTranscriptSnapshot(studentId, courseId, term, year);

  if (existing && !allowReplaceCurrent) {
    return { snapshot: existing, created: false };
  }

  if (existing && allowReplaceCurrent) {
    await StudentCourseGradeSnapshot.updateOne(
      { _id: existing._id },
      { $set: { isCurrent: false, supersededAt: new Date() } }
    );
  }

  const doc = await StudentCourseGradeSnapshot.create({
    student: studentId,
    course: courseId,
    term,
    year: Number(year),
    finalPercent,
    letterGrade,
    gradingPolicyVersion: snapshotBundle.policyVersion,
    gradingPolicyHash: snapshotBundle.policyHash,
    gradingPolicySnapshot: snapshotBundle.resolvedPolicySnapshot,
    gradingEngineVersion: engineVer,
    lifecycleStatus: lifecycleStatus || null,
    frozen: true,
    isCurrent: true,
    amendmentSequence,
    amendmentRecord: amendmentRecord || undefined,
    source: 'transcript',
    computedAt: new Date(),
  });

  return { snapshot: doc.toObject(), created: true };
}

async function getGradingContextForCalculation(course, options = {}) {
  if (options.storedPolicySnapshot) {
    const resolved = resolvedPolicyFromSnapshot(options.storedPolicySnapshot);
    if (resolved) {
      return {
        resolved,
        courseContext: courseContextFromResolvedPolicy(resolved),
        fromStoredSnapshot: true,
      };
    }
  }
  return gradingPolicyService.getCourseGradingContext(course, options);
}

module.exports = {
  buildSnapshotForCourse,
  applySnapshotToDocument,
  stampSubmissionPolicySnapshot,
  findFrozenTranscriptSnapshot,
  findCurrentSnapshotsForCourse,
  supersedeCurrentSnapshots,
  persistTranscriptSnapshot,
  getGradingContextForCalculation,
  getCourseForAssignment,
};
