const FileAsset = require('../models/fileAsset.model');
const SystemSettings = require('../models/systemSettings.model');
const academicAuditService = require('./academicAudit.service');
const { deleteStoredBlob } = require('./fileStorage.service');

async function getRetentionSettings() {
  const settings = await SystemSettings.findOne().lean();
  const storage = settings?.storage || {};
  return {
    retentionDays: storage.retentionDays ?? 365,
    deletedFileRetentionDays: storage.deletedFileRetentionDays ?? 30,
    tempUploadRetentionHours: storage.tempUploadRetentionHours ?? 24,
    archivedCourseRetentionDays: storage.archivedCourseRetentionDays ?? 730,
    exportRetentionDays: storage.exportRetentionDays ?? 90,
  };
}

/**
 * Purge soft-deleted assets past retention window (dry-run by default).
 */
async function purgeDeletedFiles({ dryRun = true, limit = 500, audit = {} } = {}) {
  const { deletedFileRetentionDays } = await getRetentionSettings();
  const cutoff = new Date(Date.now() - deletedFileRetentionDays * 24 * 60 * 60 * 1000);
  const candidates = await FileAsset.find({
    isDeleted: true,
    deletedAt: { $lte: cutoff },
  })
    .limit(limit)
    .lean();

  const results = { scanned: candidates.length, purged: 0, dryRun };
  for (const asset of candidates) {
    if (dryRun) continue;
    if (asset.storageKey) {
      await deleteStoredBlob(asset.storageKey, asset.provider).catch(() => {});
    }
    await FileAsset.deleteOne({ _id: asset._id });
    results.purged += 1;
    await academicAuditService.recordAuditEvent({
      actorId: audit.actorId,
      entityType: 'file_asset',
      entityId: asset._id,
      action: 'file_retention_purge',
      severity: 'info',
      ip: audit.ip,
      metadata: { reason: 'deleted_retention_expired' },
    }).catch(() => {});
  }
  return results;
}

/**
 * Mark stale temporary uploads for orphan cleanup.
 */
async function purgeStaleTemporaryUploads({ dryRun = true, limit = 200 } = {}) {
  const { tempUploadRetentionHours } = await getRetentionSettings();
  const cutoff = new Date(Date.now() - tempUploadRetentionHours * 60 * 60 * 1000);
  const stale = await FileAsset.find({
    category: 'temporary',
    isDeleted: false,
    createdAt: { $lte: cutoff },
    $or: [{ courseId: null }, { pageId: null }, { assignmentId: null }, { discussionId: null }],
  })
    .limit(limit)
    .select('_id');

  if (!dryRun && stale.length) {
    await FileAsset.updateMany(
      { _id: { $in: stale.map((s) => s._id) } },
      { $set: { cleanupState: 'ORPHAN_CANDIDATE', cleanupReason: 'temp_upload_expired' } }
    );
  }
  return { candidates: stale.length, dryRun };
}

module.exports = {
  getRetentionSettings,
  purgeDeletedFiles,
  purgeStaleTemporaryUploads,
};
