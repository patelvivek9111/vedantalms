const FileAsset = require('../models/fileAsset.model');
const SystemSettings = require('../models/systemSettings.model');
const academicAuditService = require('./academicAudit.service');

const BYTES_PER_GB = 1024 * 1024 * 1024;

async function getQuotaSettings() {
  const settings = await SystemSettings.findOne().lean();
  const storage = settings?.storage || {};
  return {
    maxStoragePerUserBytes: (storage.maxStoragePerUser ?? 100) * BYTES_PER_GB,
    maxStoragePerCourseBytes: (storage.maxStoragePerCourse ?? 50) * BYTES_PER_GB,
    institutionWarningBytes: (storage.institutionWarningGb ?? 500) * BYTES_PER_GB,
    adminOverride: Boolean(storage.quotaAdminOverride),
  };
}

async function getUserStorageBytes(userId) {
  const [row] = await FileAsset.aggregate([
    { $match: { uploadedBy: userId, isDeleted: false } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return row?.total || 0;
}

async function getCourseStorageBytes(courseId) {
  const [row] = await FileAsset.aggregate([
    { $match: { courseId, isDeleted: false } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return row?.total || 0;
}

async function getInstitutionStorageBytes() {
  const [row] = await FileAsset.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return row?.total || 0;
}

/**
 * Enforce per-user and per-course quotas before upload. Admins bypass unless override disabled.
 */
async function assertUploadWithinQuota({ user, courseId, additionalBytes = 0, audit = {} }) {
  const quotas = await getQuotaSettings();
  const isAdmin = user?.role === 'admin';
  if (isAdmin && quotas.adminOverride) return { allowed: true };

  if (user?._id) {
    const used = await getUserStorageBytes(user._id);
    if (used + additionalBytes > quotas.maxStoragePerUserBytes) {
      await academicAuditService.recordAuditEvent({
        actorId: user._id,
        entityType: 'file_asset',
        entityId: user._id,
        action: 'file_upload_quota_exceeded',
        severity: 'warning',
        ip: audit.ip,
        requestId: audit.requestId,
        metadata: { scope: 'user', used, limit: quotas.maxStoragePerUserBytes },
      }).catch(() => {});
      const err = new Error('Storage quota exceeded for your account');
      err.statusCode = 413;
      err.code = 'USER_QUOTA_EXCEEDED';
      throw err;
    }
  }

  if (courseId) {
    const used = await getCourseStorageBytes(courseId);
    if (used + additionalBytes > quotas.maxStoragePerCourseBytes) {
      await academicAuditService.recordAuditEvent({
        actorId: user?._id,
        entityType: 'course',
        entityId: courseId,
        action: 'file_upload_quota_exceeded',
        severity: 'warning',
        ip: audit.ip,
        requestId: audit.requestId,
        metadata: { scope: 'course', used, limit: quotas.maxStoragePerCourseBytes },
      }).catch(() => {});
      const err = new Error('Storage quota exceeded for this course');
      err.statusCode = 413;
      err.code = 'COURSE_QUOTA_EXCEEDED';
      throw err;
    }
  }

  const instUsed = await getInstitutionStorageBytes();
  if (instUsed + additionalBytes > quotas.institutionWarningBytes) {
    await academicAuditService.recordAuditEvent({
      actorId: user?._id,
      entityType: 'institution',
      entityId: 'default',
      action: 'institution_storage_warning',
      severity: 'info',
      ip: audit.ip,
      requestId: audit.requestId,
      metadata: { used: instUsed, threshold: quotas.institutionWarningBytes },
    }).catch(() => {});
  }

  return { allowed: true };
}

async function getQuotaSnapshot(userId, courseId) {
  const quotas = await getQuotaSettings();
  const [userUsed, courseUsed, institutionUsed] = await Promise.all([
    userId ? getUserStorageBytes(userId) : 0,
    courseId ? getCourseStorageBytes(courseId) : 0,
    getInstitutionStorageBytes(),
  ]);
  return {
    quotas,
    userUsed,
    courseUsed,
    institutionUsed,
    userRemaining: Math.max(0, quotas.maxStoragePerUserBytes - userUsed),
    courseRemaining: Math.max(0, quotas.maxStoragePerCourseBytes - courseUsed),
  };
}

module.exports = {
  getQuotaSettings,
  getUserStorageBytes,
  getCourseStorageBytes,
  getInstitutionStorageBytes,
  assertUploadWithinQuota,
  getQuotaSnapshot,
};
