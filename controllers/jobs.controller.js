const fs = require('fs');
const path = require('path');
const jobQueueService = require('../services/jobQueue.service');
const { verifyDownloadToken, JOBS_DIR } = require('../services/gradingJobProcessors');

exports.getJobStatus = async (req, res) => {
  try {
    const job = await jobQueueService.getJobForUser(req.params.jobId, req.user._id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({
      success: true,
      data: {
        id: job._id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        hasDownload: Boolean(job.filePath && job.status === 'completed'),
        downloadExpiresAt: job.downloadExpiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadJobExport = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'token query param is required' });
    }

    const job = await jobQueueService.getJobForUser(jobId, req.user._id);
    if (!job || job.status !== 'completed' || !job.filePath) {
      return res.status(404).json({ success: false, message: 'Export not available' });
    }

    if (job.downloadToken !== token && !verifyDownloadToken(jobId, token)) {
      const ferpaAudit = require('../services/ferpaAudit.service');
      await ferpaAudit.recordFerpaEvent({
        actorId: req.user._id,
        action: 'ferpa_suspicious_access',
        entityType: 'async_job',
        entityId: jobId,
        ip: req.ip,
        requestId: req.requestId,
        metadata: { reason: 'invalid_export_token' },
      }).catch(() => {});
      return res.status(403).json({ success: false, message: 'Invalid or expired download token' });
    }

    if (job.downloadExpiresAt && new Date() > new Date(job.downloadExpiresAt)) {
      return res.status(410).json({ success: false, message: 'Download link expired' });
    }

    const ferpaAudit = require('../services/ferpaAudit.service');
    await ferpaAudit.recordExportDownload(req, {
      jobId,
      courseId: job.payload?.courseId,
    }).catch(() => {});

    const resolved = path.resolve(job.filePath); // nosemgrep: javascript.express.security.audit.express-path-join-resolve-traversal.express-path-join-resolve-traversal
    if (!resolved.startsWith(path.resolve(JOBS_DIR)) || !fs.existsSync(resolved)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.download(resolved, job.fileName || 'gradebook-export.xlsx');
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
