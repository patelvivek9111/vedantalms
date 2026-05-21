const fileRecoveryCenter = require('../services/fileRecoveryCenter.service');
const fileBulkOperations = require('../services/fileBulkOperations.service');
const { listVersionsForAsset } = require('../services/fileVersioning.service');
const { enqueueJob } = require('../services/jobQueue.service');

exports.listFiles = async (req, res) => {
  try {
    const data = await fileRecoveryCenter.listRecoverableFiles({
      filter: req.query.filter || 'deleted',
      courseId: req.query.courseId,
      scanStatus: req.query.scanStatus,
      search: req.query.search,
      cursor: req.query.cursor,
      limit: Math.min(parseInt(req.query.limit || '50', 10), 100),
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getAuditTimeline = async (req, res) => {
  try {
    const data = await fileRecoveryCenter.getFileAuditTimeline(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getVersions = async (req, res) => {
  try {
    const data = await listVersionsForAsset(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.previewRestore = async (req, res) => {
  try {
    const blobRetention = require('../services/blobRetention.service');
    const data = await blobRetention.previewRestoreDryRun(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.restoreFile = async (req, res) => {
  try {
    const asset = await fileRecoveryCenter.restoreDeletedFile(req.params.id, req.user, {
      ip: req.ip,
      requestId: req.requestId,
    });
    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.restoreVersion = async (req, res) => {
  try {
    const { versionId } = req.body;
    const asset = await fileRecoveryCenter.restoreFileVersion(req.params.id, versionId, req.user, {
      ip: req.ip,
    });
    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.quarantine = async (req, res) => {
  try {
    const asset = await fileRecoveryCenter.quarantineFile(req.params.id, req.body.reason, req.user, {
      ip: req.ip,
    });
    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.release = async (req, res) => {
  try {
    const asset = await fileRecoveryCenter.releaseQuarantine(req.params.id, req.user, { ip: req.ip });
    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.bulkAction = async (req, res) => {
  try {
    const { action, fileAssetIds, reason, dryRun } = req.body;
    const ids = Array.isArray(fileAssetIds) ? fileAssetIds.map(String) : [];
    if (!ids.length) {
      return res.status(400).json({ success: false, message: 'fileAssetIds required' });
    }

    if (action === 'enqueue') {
      const { job } = await enqueueJob(
        req.body.jobType || 'files.bulk.restore',
        { fileAssetIds: ids, reason, dryRun: dryRun !== false },
        req.user
      );
      return res.json({ success: true, data: { job } });
    }

    let result;
    const audit = { ip: req.ip, requestId: req.requestId };
    switch (action) {
      case 'restore':
        result = await fileBulkOperations.bulkRestore(ids, req.user, audit);
        break;
      case 'quarantine':
        result = await fileBulkOperations.bulkQuarantine(ids, reason, req.user, audit);
        break;
      case 'release':
        result = await fileBulkOperations.bulkRelease(ids, req.user, audit);
        break;
      case 'retention_mark':
        result = await fileBulkOperations.bulkMarkRetention(ids, req.user, audit);
        break;
      case 'zip_export':
        result = await fileBulkOperations.bulkZipExport(ids, req.user, audit);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unknown bulk action' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
