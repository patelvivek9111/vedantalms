const AsyncJob = require('../models/asyncJob.model');
const FileAsset = require('../models/fileAsset.model');
const SystemAuditEvent = require('../models/systemAuditEvent.model');
const MigrationRun = require('../models/migrationRun.model');
const mongoose = require('mongoose');
const { isRedisConfigured } = require('../utils/bullmqConnection');
const { getWorkerStatus } = require('../services/jobQueue.service');
const { getFileOpsMetrics } = require('../services/fileOpsMetrics.service');
const os = require('os');

async function getLightFileMetrics() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [orphanCandidateCount, integrityFailureSignals, unsafeFileCount, failedUploadsLast7d] =
    await Promise.all([
      FileAsset.countDocuments({ cleanupState: 'ORPHAN_CANDIDATE' }),
      FileAsset.countDocuments({
        isDeleted: false,
        $or: [{ checksumSha256: '' }, { storageKey: '' }],
      }),
      FileAsset.countDocuments({ scanStatus: 'unsafe', isDeleted: false }),
      SystemAuditEvent.countDocuments({
        action: 'file_upload',
        severity: 'critical',
        createdAt: { $gte: weekAgo },
      }),
    ]);
  return {
    integrity: { orphanCandidateCount, integrityFailureSignals },
    security: { unsafeFileCount, failedUploadsLast7d },
  };
}

exports.getOpsDashboard = async (req, res) => {
  try {
    const [activeJobs, failedJobs, fileMetrics] = await Promise.all([
      AsyncJob.find({ status: { $in: ['pending', 'active'] } })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('type status error createdAt updatedAt')
        .lean(),
      AsyncJob.find({ status: 'failed' })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('type status error createdAt updatedAt')
        .lean(),
      getLightFileMetrics(),
    ]);

    const worker = getWorkerStatus();

    res.json({
      success: true,
      data: {
        activeJobs,
        failedJobs,
        fileMetrics,
        worker,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.retryJob = async (req, res) => {
  try {
    const { requeueExistingJob } = require('../services/jobQueue.service');
    const result = await requeueExistingJob(req.params.id);
    res.json({ success: true, data: result.job });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.dismissJob = async (req, res) => {
  try {
    const { dismissJob } = require('../services/jobQueue.service');
    const result = await dismissJob(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getFileOps = async (req, res) => {
  try {
    const metrics = await getFileOpsMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const fileRecoveryService = require('../services/fileRecovery.service');
const integrityMonitoringService = require('../services/integrityMonitoring.service');

exports.getRecoverySummary = async (req, res) => {
  try {
    const dryRun = req.query.dryRun !== 'false';
    const data = await fileRecoveryService.runRecoveryDryRun();
    res.json({ success: true, data: { ...data, dryRun } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.postRecoveryAction = async (req, res) => {
  try {
    const { action, jobId, dryRun } = req.body;
    if (action === 'mark_orphans') {
      const result = await fileRecoveryService.markOrphanCandidates({ dryRun: dryRun !== false });
      return res.json({ success: true, data: result });
    }
    if (action === 'retry_job' && jobId) {
      const job = await fileRecoveryService.retryFailedJob(jobId, req.user);
      return res.json({ success: true, data: job });
    }
    if (action === 'integrity_report') {
      const result = await integrityMonitoringService.runIntegrityReport();
      return res.json({ success: true, data: result });
    }
    return res.status(400).json({ success: false, message: 'Unknown recovery action' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getDependenciesHealth = async (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  const redisConfigured = isRedisConfigured();
  const { getWorkerStatus } = require('../services/jobQueue.service');
  const worker = getWorkerStatus();
  let migrationState = null;
  try {
    migrationState = await MigrationRun.find({}).sort({ appliedAt: -1 }).limit(5).lean();
  } catch {
    migrationState = [];
  }

  const freeMem = os.freemem();
  const totalMem = os.totalmem();

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    mongoConnected,
    redisConfigured,
    worker,
    diskSpace: {
      freeMemBytes: freeMem,
      totalMemBytes: totalMem,
      freePercent: Number(((freeMem / totalMem) * 100).toFixed(2)),
    },
    workerHeartbeat: worker.heartbeatAt || process.env.GRADING_WORKER_HEARTBEAT_AT || null,
    migrationState,
  });
};
