const FileAsset = require('../models/fileAsset.model');
const AsyncJob = require('../models/asyncJob.model');
const academicAuditService = require('./academicAudit.service');
const { detectOrphans } = require('./fileCleanup.service');
const { runMaintenanceBundle } = require('./courseMaintenance.service');

async function listFailedUploads({ limit = 50 } = {}) {
  return SystemAuditEventFind('file_upload', 'critical', limit);
}

async function SystemAuditEventFind(action, severity, limit) {
  const SystemAuditEvent = require('../models/systemAuditEvent.model');
  return SystemAuditEvent.find({ action, severity })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function listStuckJobs({ olderThanMinutes = 30, limit = 50 } = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  return AsyncJob.find({
    status: { $in: ['pending', 'active'] },
    updatedAt: { $lt: cutoff },
  })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();
}

async function listUnsafeFiles({ limit = 100 } = {}) {
  return FileAsset.find({ scanStatus: 'unsafe', isDeleted: false })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('originalName category courseId scanStatus createdAt')
    .lean();
}

async function markOrphanCandidates({ dryRun = true, limit = 100 } = {}) {
  const report = await detectOrphans({ limit });
  if (dryRun) {
    return { dryRun: true, report };
  }
  let marked = 0;
  for (const row of report.candidates || []) {
    if (row.assetId) {
      await FileAsset.findByIdAndUpdate(row.assetId, { cleanupState: 'ORPHAN_CANDIDATE' });
      marked += 1;
    }
  }
  await academicAuditService.recordAuditEvent({
    actorId: null,
    entityType: 'system',
    entityId: 'file_recovery',
    action: 'orphan_mark_candidates',
    metadata: { marked, dryRun: false },
  }).catch(() => {});
  return { dryRun: false, marked, report };
}

async function retryFailedJob(jobId, user) {
  const { requeueExistingJob } = require('./jobQueue.service');
  const result = await requeueExistingJob(jobId);
  return result.job;
}

async function runRecoveryDryRun() {
  const [orphanReport, unsafe, stuckJobs, maintenance] = await Promise.all([
    detectOrphans({ limit: 50 }),
    listUnsafeFiles({ limit: 20 }),
    listStuckJobs({ limit: 20 }),
    runMaintenanceBundle({ dryRun: true }),
  ]);
  return { orphanReport, unsafeCount: unsafe.length, unsafe, stuckJobs, maintenance };
}

module.exports = {
  listStuckJobs,
  listUnsafeFiles,
  markOrphanCandidates,
  retryFailedJob,
  runRecoveryDryRun,
  listFailedUploads,
};
