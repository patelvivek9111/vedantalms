const FileAsset = require('../models/fileAsset.model');
const SystemAuditEvent = require('../models/systemAuditEvent.model');
const academicAuditService = require('./academicAudit.service');
const fileAssetService = require('./fileAsset.service');
const { markFileUnsafe, markFileClean } = require('./fileScan.service');
const { listVersionsForAsset } = require('./fileVersioning.service');
const { ADMIN_ROLES } = require('../middleware/academicPermissions');
const fileRecoveryService = require('./fileRecovery.service');

function assertRecoveryAdmin(user) {
  if (!user || !ADMIN_ROLES.has(user.role)) {
    const err = new Error('Admin access required for file recovery');
    err.statusCode = 403;
    throw err;
  }
}

async function listRecoverableFiles({
  filter = 'deleted',
  courseId,
  scanStatus,
  search,
  cursor,
  limit = 50,
} = {}) {
  const q = {};
  if (filter === 'deleted') q.isDeleted = true;
  else if (filter === 'quarantine') q.scanStatus = 'unsafe';
  else if (filter === 'all') q.isDeleted = { $in: [true, false] };
  if (courseId) q.courseId = courseId;
  if (scanStatus) q.scanStatus = scanStatus;
  if (search && String(search).trim()) {
    q.originalName = { $regex: String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (cursor) q._id = { $lt: cursor };

  const rows = await FileAsset.find(q)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('uploadedBy', 'firstName lastName email')
    .lean();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;
  const blobRetention = require('./blobRetention.service');

  const enriched = items.map((row) => ({
    ...row,
    restoreEligibility: blobRetention.getRestoreEligibility(row),
  }));

  return { items: enriched, nextCursor, hasMore };
}

async function getFileAuditTimeline(fileAssetId, { limit = 100 } = {}) {
  const events = await SystemAuditEvent.find({
    $or: [
      { entityType: 'file_asset', entityId: fileAssetId },
      { 'metadata.fileAssetId': fileAssetId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const ferpa = require('../models/systemAuditEvent.model');
  const ferpaEvents = await ferpa
    .find({ entityType: 'file_asset', entityId: fileAssetId, action: /ferpa|download|stream/i })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
    .catch(() => []);

  return { events, suspicious: events.filter((e) => /suspicious|unsafe|ferpa/i.test(e.action)) };
}

async function restoreDeletedFile(fileAssetId, user, audit = {}) {
  assertRecoveryAdmin(user);
  const asset = await FileAsset.findById(fileAssetId);
  if (!asset) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }
  if (asset.lifecycleLocked) {
    const err = new Error('File is lifecycle-locked and cannot be restored without override');
    err.statusCode = 423;
    throw err;
  }
  const blobRetention = require('./blobRetention.service');
  const eligibility = blobRetention.getRestoreEligibility(asset);
  if (eligibility.eligible && eligibility.reason === 'quarantine_available') {
    await blobRetention.restoreBlobFromQuarantine(asset, {
      actorId: user._id,
      ip: audit.ip,
      requestId: audit.requestId,
    });
  } else {
    asset.isDeleted = false;
    asset.deletedAt = undefined;
    asset.cleanupState = 'ACTIVE';
    await asset.save();
  }

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: asset._id,
    action: 'file_recovery_restored',
    severity: 'info',
    ip: audit.ip,
    requestId: audit.requestId,
    metadata: { type: 'soft_delete_restore', blobRestored: eligibility.reason === 'quarantine_available' },
  }).catch(() => {});

  return asset;
}

async function restoreFileVersion(fileAssetId, targetVersionId, user, audit = {}) {
  assertRecoveryAdmin(user);
  const { versions, current } = await listVersionsForAsset(fileAssetId);
  const target = versions.find((v) => String(v._id) === String(targetVersionId)) ||
    (String(current?._id) === String(targetVersionId) ? current : null);
  if (!target) {
    const err = new Error('Version not found');
    err.statusCode = 404;
    throw err;
  }
  if (current) {
    await FileAsset.updateOne({ _id: current._id }, { $set: { isCurrentVersion: false } });
  }
  await FileAsset.updateOne(
    { _id: target._id },
    { $set: { isCurrentVersion: true, isDeleted: false, cleanupState: 'ACTIVE' } }
  );

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: fileAssetId,
    action: 'file_version_restored',
    severity: 'info',
    ip: audit.ip,
    metadata: { restoredVersionId: targetVersionId },
  }).catch(() => {});

  return FileAsset.findById(target._id);
}

async function quarantineFile(fileAssetId, reason, user, audit = {}) {
  assertRecoveryAdmin(user);
  return markFileUnsafe(fileAssetId, reason || 'admin_quarantine', {
    actorId: user._id,
    ip: audit.ip,
    requestId: audit.requestId,
  });
}

async function releaseQuarantine(fileAssetId, user, audit = {}) {
  assertRecoveryAdmin(user);
  const asset = await markFileClean(fileAssetId);
  if (asset) {
    asset.lifecycleLocked = false;
    await asset.save();
  }
  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: fileAssetId,
    action: 'file_quarantine_released',
    severity: 'info',
    ip: audit.ip,
  }).catch(() => {});
  return asset;
}

module.exports = {
  listRecoverableFiles,
  getFileAuditTimeline,
  restoreDeletedFile,
  restoreFileVersion,
  quarantineFile,
  releaseQuarantine,
  runRecoveryDryRun: fileRecoveryService.runRecoveryDryRun,
};
