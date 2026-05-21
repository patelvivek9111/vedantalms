const FileAsset = require('../models/fileAsset.model');
const SystemSettings = require('../models/systemSettings.model');
const academicAuditService = require('./academicAudit.service');
const { getRetentionSettings } = require('./fileRetention.service');
const blobRetention = require('./blobRetention.service');

async function getGovernanceSettings() {
  const settings = await SystemSettings.findOne().lean();
  const storage = settings?.storage || {};
  const retention = await getRetentionSettings();
  return {
    legalHoldEnabled: storage.legalHoldEnabled !== false,
    archivedCourseRetentionDays: storage.archivedCourseRetentionDays ?? 730,
    exportRetentionDays: storage.exportRetentionDays ?? retention.exportRetentionDays ?? 90,
    ...retention,
  };
}

async function setLegalHold(fileAssetId, user, { hold = true, reason } = {}, audit = {}) {
  const asset = await FileAsset.findById(fileAssetId);
  if (!asset) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }
  asset.metadata = {
    ...(asset.metadata || {}),
    legalHold: hold,
    legalHoldReason: reason || 'institutional_hold',
    legalHoldAt: hold ? new Date().toISOString() : undefined,
  };
  if (hold) asset.lifecycleLocked = true;
  await asset.save();

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: asset._id,
    action: hold ? 'file_legal_hold_applied' : 'file_legal_hold_released',
    severity: 'info',
    ip: audit.ip,
    metadata: { reason },
  }).catch(() => {});

  return asset;
}

async function evaluateRetentionPolicy({ dryRun = true, limit = 200 } = {}) {
  const settings = await getGovernanceSettings();
  const candidates = await FileAsset.find({
    isDeleted: true,
    'metadata.legalHold': { $ne: true },
    cleanupState: { $in: ['SOFT_DELETED', 'PENDING_DELETE'] },
  })
    .limit(limit)
    .lean();

  const report = {
    dryRun,
    candidates: candidates.length,
    purgeEligible: 0,
    holdBlocked: 0,
  };

  for (const asset of candidates) {
    if (asset.metadata?.legalHold) {
      report.holdBlocked += 1;
      continue;
    }
    const el = blobRetention.getRestoreEligibility(asset);
    if (!el.eligible) report.purgeEligible += 1;
  }

  return { ...report, settings };
}

async function getGovernanceReport() {
  const [legalHoldCount, pendingPurge, retentionMetrics] = await Promise.all([
    FileAsset.countDocuments({ 'metadata.legalHold': true }),
    FileAsset.countDocuments({ cleanupState: 'SOFT_DELETED', isDeleted: true }),
    blobRetention.getRetentionMetrics(),
  ]);
  return {
    legalHoldCount,
    pendingPurge,
    retentionMetrics,
    settings: await getGovernanceSettings(),
  };
}

module.exports = {
  getGovernanceSettings,
  setLegalHold,
  evaluateRetentionPolicy,
  getGovernanceReport,
};
