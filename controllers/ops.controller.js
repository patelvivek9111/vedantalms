const AsyncJob = require('../models/asyncJob.model');
const SystemAuditEvent = require('../models/systemAuditEvent.model');
const MigrationRun = require('../models/migrationRun.model');
const mongoose = require('mongoose');
const { isRedisConfigured } = require('../utils/bullmqConnection');
const os = require('os');
const { getFileOpsMetrics } = require('../services/fileOpsMetrics.service');

exports.getOpsDashboard = async (req, res) => {
  try {
    const [activeJobs, failedJobs, recentPolicyAudits, recentAmendments, recentFinalizations] =
      await Promise.all([
        AsyncJob.find({ status: { $in: ['pending', 'active'] } })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
        AsyncJob.find({ status: 'failed' })
          .sort({ updatedAt: -1 })
          .limit(50)
          .lean(),
        SystemAuditEvent.find({ action: /policy/i })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        SystemAuditEvent.find({ action: 'lifecycle_amended' })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        SystemAuditEvent.find({ action: 'lifecycle_finalized' })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
      ]);

    const exportQueue = activeJobs.filter((j) => j.type === 'export.gradebook');

    const fileMetrics = await getFileOpsMetrics().catch(() => null);

    res.json({
      success: true,
      data: {
        activeJobs,
        failedJobs,
        exportQueue,
        recentPolicyAudits,
        recentAmendments,
        recentFinalizations,
        fileMetrics,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    diskSpace: {
      freeMemBytes: freeMem,
      totalMemBytes: totalMem,
      freePercent: Number(((freeMem / totalMem) * 100).toFixed(2)),
    },
    workerHeartbeat: process.env.GRADING_WORKER_HEARTBEAT_AT || null,
    migrationState,
  });
};
