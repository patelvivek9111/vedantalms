const crypto = require('crypto');
const FileAsset = require('../models/fileAsset.model');
const Course = require('../models/course.model');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const {
  isEnrolledStudent,
  isCourseGradingStaff,
  canViewCourseGrades,
  canAccessStudentRecord,
  ADMIN_ROLES,
  REGISTRAR_ROLES,
} = require('../middleware/academicPermissions');
const { resolveCourseForAssignment } = require('./fileLifecycle.service');
const ferpaAudit = require('./ferpaAudit.service');

function accessDenied(message = 'Access denied') {
  const err = new Error(message);
  err.statusCode = 403;
  return err;
}

async function loadFileAsset(fileAssetId) {
  const asset = await FileAsset.findById(fileAssetId);
  if (!asset || asset.isDeleted) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }
  return asset;
}

async function resolveCourseContext(asset) {
  if (asset.courseId) {
    return Course.findById(asset.courseId);
  }
  if (asset.assignmentId) {
    return resolveCourseForAssignment(asset.assignmentId);
  }
  if (asset.submissionId) {
    const sub = await Submission.findById(asset.submissionId).select('assignment').lean();
    if (sub?.assignment) return resolveCourseForAssignment(sub.assignment);
  }
  return null;
}

/**
 * Institutional access decision for FileAsset download/stream/metadata.
 */
async function assertCanAccessFileAsset(user, fileAssetId, { ip, requestId } = {}) {
  const asset = await loadFileAsset(fileAssetId);

  if (asset.visibility === 'public') {
    return { asset, course: null };
  }

  if (!user) {
    await ferpaAudit.recordFerpaEvent({
      actorId: null,
      action: 'ferpa_suspicious_access',
      entityType: 'file_asset',
      entityId: fileAssetId,
      ip,
      requestId,
      metadata: { reason: 'unauthenticated_file_access' },
    }).catch(() => {});
    throw accessDenied('Authentication required');
  }

  if (ADMIN_ROLES.has(user.role)) {
    return { asset, course: await resolveCourseContext(asset) };
  }

  if (String(asset.uploadedBy) === String(user._id) && asset.accessScope?.ownerOnly !== false) {
    return { asset, course: await resolveCourseContext(asset) };
  }

  const course = await resolveCourseContext(asset);

  if (asset.category === 'profile') {
    if (String(asset.uploadedBy) === String(user._id)) return { asset, course: null };
    return { asset, course: null };
  }

  if (asset.category === 'grade-export' || asset.category === 'transcript') {
    if (REGISTRAR_ROLES.has(user.role) || (course && canViewCourseGrades(user, course))) {
      return { asset, course };
    }
    throw accessDenied();
  }

  if (!course) {
    if (asset.category === 'system' && REGISTRAR_ROLES.has(user.role)) {
      return { asset, course: null };
    }
    throw accessDenied('No course context for file');
  }

  if (asset.accessScope?.instructorOnly) {
    if (!isCourseGradingStaff(user, course)) throw accessDenied();
    return { asset, course };
  }

  if (asset.category === 'submission') {
    const sub = asset.submissionId
      ? await Submission.findById(asset.submissionId).lean()
      : null;
    if (user.role === 'student') {
      if (!isEnrolledStudent(user, course)) throw accessDenied();
      if (sub && String(sub.student) !== String(user._id)) {
        await ferpaAudit.recordFerpaEvent({
          actorId: user._id,
          action: 'ferpa_cross_student_attempt',
          entityType: 'file_asset',
          entityId: fileAssetId,
          ip,
          requestId,
          metadata: { submissionStudent: String(sub.student) },
        }).catch(() => {});
        throw accessDenied('Cannot access another student submission file');
      }
      return { asset, course };
    }
    if (isCourseGradingStaff(user, course) || canViewCourseGrades(user, course)) {
      if (sub && !canAccessStudentRecord(user, sub.student)) {
        throw accessDenied();
      }
      return { asset, course };
    }
    throw accessDenied();
  }

  if (asset.category === 'assignment' || asset.category === 'syllabus' || asset.category === 'page' || asset.category === 'announcement') {
    if (user.role === 'student') {
      if (!isEnrolledStudent(user, course)) throw accessDenied();
      return { asset, course };
    }
    if (isCourseGradingStaff(user, course) || REGISTRAR_ROLES.has(user.role)) {
      return { asset, course };
    }
    throw accessDenied();
  }

  if (asset.accessScope?.enrolledOnly && user.role === 'student') {
    if (!isEnrolledStudent(user, course)) throw accessDenied();
    return { asset, course };
  }

  if (isCourseGradingStaff(user, course) || isEnrolledStudent(user, course)) {
    return { asset, course };
  }

  await ferpaAudit.recordFerpaEvent({
    actorId: user._id,
    action: 'ferpa_suspicious_access',
    entityType: 'file_asset',
    entityId: fileAssetId,
    ip,
    requestId,
    metadata: { category: asset.category, courseId: String(course._id) },
  }).catch(() => {});

  throw accessDenied();
}

function createFileDownloadToken(fileAssetId, userId, options = {}) {
  const secret = process.env.FILE_DOWNLOAD_SECRET || process.env.JOB_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'file-download-secret';
  const ttlMs = options.ttlSeconds
    ? options.ttlSeconds * 1000
    : parseInt(process.env.FILE_DOWNLOAD_TTL_MS || `${60 * 60 * 1000}`, 10);
  const expiresAt = Date.now() + ttlMs;
  const payload = `${fileAssetId}|${userId}|${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return {
    token: Buffer.from(`${payload}|${sig}`).toString('base64url'),
    expiresAt: new Date(expiresAt),
  };
}

function verifyFileDownloadToken(fileAssetId, userId, token) {
  const secret = process.env.FILE_DOWNLOAD_SECRET || process.env.JOB_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'file-download-secret';
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 4) return false;
    const [payloadAssetId, payloadUserId, expiresAtPart, sig] = parts;
    if (payloadAssetId !== String(fileAssetId)) return false;
    if (payloadUserId !== String(userId)) return false;
    if (Date.now() > Number(expiresAtPart)) return false;
    const payload = `${payloadAssetId}|${payloadUserId}|${expiresAtPart}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return sig === expected;
  } catch {
    return false;
  }
}

module.exports = {
  loadFileAsset,
  assertCanAccessFileAsset,
  createFileDownloadToken,
  verifyFileDownloadToken,
};
