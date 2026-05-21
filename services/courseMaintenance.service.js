const FileAsset = require('../models/fileAsset.model');
const SystemAuditEvent = require('../models/systemAuditEvent.model');
const { detectOrphans } = require('./fileCleanup.service');
const { getFileOpsMetrics } = require('./fileOpsMetrics.service');
const academicAuditService = require('./academicAudit.service');

async function runMaintenanceBundle({ dryRun = true } = {}) {
  const summary = {
    startedAt: new Date().toISOString(),
    dryRun,
    orphanReport: null,
    expiredTokensCleaned: 0,
    staleUploadsMarked: 0,
    integritySignals: 0,
    opsMetrics: null,
  };

  summary.orphanReport = await detectOrphans({ limit: 100 });

  const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stale = await FileAsset.find({
    category: 'temporary',
    createdAt: { $lt: staleCutoff },
    submissionId: null,
    assignmentId: null,
    pageId: null,
    announcementId: null,
  }).limit(500);

  for (const asset of stale) {
    if (!dryRun) {
      asset.cleanupState = 'ORPHAN_CANDIDATE';
      await asset.save();
    }
    summary.staleUploadsMarked += 1;
  }

  summary.integritySignals = await FileAsset.countDocuments({
    isDeleted: false,
    $or: [{ checksumSha256: '' }, { storageKey: '' }],
  });

  summary.opsMetrics = await getFileOpsMetrics();

  const fileRetention = require('./fileRetention.service');
  summary.retentionPurge = await fileRetention.purgeDeletedFiles({ dryRun, limit: 200 });
  summary.tempUploadRetention = await fileRetention.purgeStaleTemporaryUploads({ dryRun, limit: 200 });

  await academicAuditService.recordAuditEvent({
    actorId: null,
    entityType: 'system',
    entityId: 'maintenance',
    action: 'file_maintenance_completed',
    metadata: summary,
    severity: summary.integritySignals > 0 ? 'warning' : 'info',
  }).catch(() => {});

  summary.completedAt = new Date().toISOString();
  return summary;
}

module.exports = {
  runMaintenanceBundle,
};
