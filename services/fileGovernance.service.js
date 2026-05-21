const FileAsset = require('../models/fileAsset.model');
const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');
const { FINALIZED_STATUSES } = require('./gradeLifecycle.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const academicAuditService = require('./academicAudit.service');

const IMMUTABLE_CATEGORIES = new Set(['grade-export', 'transcript']);

async function isCourseFinalized(courseId) {
  if (!courseId) return false;
  const Course = require('../models/course.model');
  const course = await Course.findById(courseId).lean();
  if (!course) return false;
  const { term, year } = getSemesterFromCourse(course);
  const lifecycle = await CourseGradeLifecycle.findOne({
    course: courseId,
    term,
    year: Number(year),
  }).lean();
  return lifecycle && FINALIZED_STATUSES.has(lifecycle.status);
}

async function assertFileMutable(asset, { action = 'mutate', user, audit = {} } = {}) {
  if (!asset) {
    const err = new Error('File asset not found');
    err.statusCode = 404;
    throw err;
  }
  if (asset.lifecycleLocked || asset.metadata?.legalHold) {
    const err = new Error(`File is immutable (${action} blocked)`);
    err.statusCode = 403;
    throw err;
  }
  if (IMMUTABLE_CATEGORIES.has(asset.category)) {
    const err = new Error(`Category ${asset.category} files are append-only/immutable`);
    err.statusCode = 403;
    throw err;
  }
  if (asset.courseId && (await isCourseFinalized(asset.courseId))) {
    if (['submission', 'assignment'].includes(asset.category)) {
      const err = new Error('Academic files are locked for finalized course terms');
      err.statusCode = 403;
      throw err;
    }
  }
  if (asset.category === 'submission' && asset.submissionId) {
    const Submission = require('../models/Submission');
    const sub = await Submission.findById(asset.submissionId).lean();
    if (sub?.gradedAt && action === 'delete') {
      const err = new Error('Graded submission files cannot be deleted');
      err.statusCode = 403;
      throw err;
    }
  }
  return true;
}

async function lockAssetsForFinalizedCourse(courseId) {
  const finalized = await isCourseFinalized(courseId);
  if (!finalized) return { locked: 0 };
  const result = await FileAsset.updateMany(
    {
      courseId,
      category: { $in: ['submission', 'assignment', 'syllabus', 'page', 'announcement'] },
      lifecycleLocked: false,
    },
    { $set: { lifecycleLocked: true } }
  );
  return { locked: result.modifiedCount || 0 };
}

async function recordFileReplacement(audit, { oldAssetIds, newAssetIds, context = {} }) {
  return academicAuditService.recordAuditEvent({
    actorId: audit.userId,
    entityType: 'file_asset',
    entityId: newAssetIds[0] || 'batch',
    action: 'file_replace',
    before: { previousAssetIds: oldAssetIds },
    after: { newAssetIds, ...context },
    ip: audit.ip,
    requestId: audit.requestId,
    metadata: context,
  });
}

async function recordRestoreAttempt(audit, { fileAssetId, reason }) {
  return academicAuditService.recordAuditEvent({
    actorId: audit.userId,
    entityType: 'file_asset',
    entityId: fileAssetId,
    action: 'file_restore_attempt',
    severity: 'warning',
    ip: audit.ip,
    requestId: audit.requestId,
    metadata: { reason },
  });
}

module.exports = {
  IMMUTABLE_CATEGORIES,
  isCourseFinalized,
  assertFileMutable,
  lockAssetsForFinalizedCourse,
  recordFileReplacement,
  recordRestoreAttempt,
};
