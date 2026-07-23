const mongoose = require('mongoose');
const FileAsset = require('../models/fileAsset.model');
const SystemSettings = require('../models/systemSettings.model');
const academicAuditService = require('./academicAudit.service');
const {
  assertStorageWithinQuota,
  resolveRootAccountId,
} = require('./tenancy/accountQuota.service');
const { getTenantRootAccountId } = require('../utils/tenantContext');

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  const value = String(id);
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : id;
}

const BYTES_PER_GB = 1024 * 1024 * 1024;

async function getQuotaSettings(rootAccountId) {
  const id = rootAccountId || getTenantRootAccountId();
  const settings = id
    ? await SystemSettings.getSettings(id)
    : await SystemSettings.findOne().lean();
  const lean = settings?.toObject ? settings.toObject() : settings;
  const storage = lean?.storage || {};
  return {
    maxStoragePerUserBytes: (storage.maxStoragePerUser ?? 100) * BYTES_PER_GB,
    maxStoragePerCourseBytes: (storage.maxStoragePerCourse ?? 50) * BYTES_PER_GB,
    institutionWarningBytes: (storage.institutionWarningGb ?? 500) * BYTES_PER_GB,
    adminOverride: Boolean(storage.quotaAdminOverride),
  };
}

function tenantMatch(rootAccountId) {
  return rootAccountId ? { rootAccountId: toObjectId(rootAccountId) } : {};
}

async function getUserStorageBytes(userId, rootAccountId) {
  const [row] = await FileAsset.aggregate([
    {
      $match: {
        uploadedBy: toObjectId(userId),
        isDeleted: false,
        ...tenantMatch(rootAccountId),
      },
    },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return row?.total || 0;
}

async function getCourseStorageBytes(courseId, rootAccountId) {
  const [row] = await FileAsset.aggregate([
    {
      $match: {
        courseId: toObjectId(courseId),
        isDeleted: false,
        ...tenantMatch(rootAccountId),
      },
    },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return row?.total || 0;
}

async function getInstitutionStorageBytes(rootAccountId) {
  const match = { isDeleted: false, ...tenantMatch(rootAccountId) };
  const [row] = await FileAsset.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return row?.total || 0;
}

/**
 * Enforce per-user, per-course, and per-tenant hard quotas before upload.
 */
async function assertUploadWithinQuota({ user, courseId, additionalBytes = 0, audit = {} }) {
  const rootAccountId =
    resolveRootAccountId(user?.rootAccountId) || getTenantRootAccountId() || null;
  const quotas = await getQuotaSettings(rootAccountId);
  const isAdmin = user?.role === 'admin' || user?.role === 'platform_admin';
  if (isAdmin && quotas.adminOverride) {
    // Still enforce hard tenant plan cap for platform safety
  } else {
    if (user?._id) {
      const used = await getUserStorageBytes(user._id, rootAccountId);
      if (used + additionalBytes > quotas.maxStoragePerUserBytes) {
        await academicAuditService
          .recordAuditEvent({
            actorId: user._id,
            entityType: 'file_asset',
            entityId: user._id,
            action: 'file_upload_quota_exceeded',
            severity: 'warning',
            ip: audit.ip,
            requestId: audit.requestId,
            rootAccountId,
            metadata: { scope: 'user', used, limit: quotas.maxStoragePerUserBytes },
          })
          .catch(() => {});
        const err = new Error('Storage quota exceeded for your account');
        err.statusCode = 413;
        err.code = 'USER_QUOTA_EXCEEDED';
        throw err;
      }
    }

    if (courseId) {
      const used = await getCourseStorageBytes(courseId, rootAccountId);
      if (used + additionalBytes > quotas.maxStoragePerCourseBytes) {
        await academicAuditService
          .recordAuditEvent({
            actorId: user?._id,
            entityType: 'course',
            entityId: courseId,
            action: 'file_upload_quota_exceeded',
            severity: 'warning',
            ip: audit.ip,
            requestId: audit.requestId,
            rootAccountId,
            metadata: { scope: 'course', used, limit: quotas.maxStoragePerCourseBytes },
          })
          .catch(() => {});
        const err = new Error('Storage quota exceeded for this course');
        err.statusCode = 413;
        err.code = 'COURSE_QUOTA_EXCEEDED';
        throw err;
      }
    }
  }

  if (rootAccountId) {
    await assertStorageWithinQuota(rootAccountId, additionalBytes);
  }

  const instUsed = await getInstitutionStorageBytes(rootAccountId);
  if (instUsed + additionalBytes > quotas.institutionWarningBytes) {
    await academicAuditService
      .recordAuditEvent({
        actorId: user?._id,
        entityType: 'institution',
        entityId: rootAccountId || 'default',
        action: 'institution_storage_warning',
        severity: 'info',
        ip: audit.ip,
        requestId: audit.requestId,
        rootAccountId,
        metadata: { used: instUsed, threshold: quotas.institutionWarningBytes },
      })
      .catch(() => {});
  }

  return { allowed: true };
}

async function getQuotaSnapshot(userId, courseId, rootAccountId) {
  const rid = rootAccountId || getTenantRootAccountId();
  const quotas = await getQuotaSettings(rid);
  const [userUsed, courseUsed, institutionUsed] = await Promise.all([
    userId ? getUserStorageBytes(userId, rid) : 0,
    courseId ? getCourseStorageBytes(courseId, rid) : 0,
    getInstitutionStorageBytes(rid),
  ]);
  return {
    quotas,
    userUsed,
    courseUsed,
    institutionUsed,
    userRemaining: Math.max(0, quotas.maxStoragePerUserBytes - userUsed),
    courseRemaining: Math.max(0, quotas.maxStoragePerCourseBytes - courseUsed),
    rootAccountId: rid,
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
