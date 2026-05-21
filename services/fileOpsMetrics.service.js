const fs = require('fs');
const path = require('path');
const FileAsset = require('../models/fileAsset.model');
const SystemAuditEvent = require('../models/systemAuditEvent.model');
const { paths } = require('../config/paths');
const { detectOrphans } = require('./fileCleanup.service');

function dirSizeBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

async function getFileOpsMetrics() {
  const [
    totalAssets,
    orphanCandidates,
    unsafeFiles,
    versionedFiles,
    integrityFailures,
    suspiciousDownloads,
    failedUploads,
    largestCourses,
    exportCoverage,
  ] = await Promise.all([
    FileAsset.countDocuments({ isDeleted: false }),
    FileAsset.countDocuments({ cleanupState: 'ORPHAN_CANDIDATE' }),
    FileAsset.countDocuments({ scanStatus: 'unsafe' }),
    FileAsset.countDocuments({ versionNumber: { $gt: 1 } }),
    FileAsset.countDocuments({
      isDeleted: false,
      $or: [{ checksumSha256: '' }, { storageKey: '' }],
    }),
    SystemAuditEvent.countDocuments({
      action: { $in: ['ferpa_suspicious_access', 'file_marked_unsafe'] },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    SystemAuditEvent.countDocuments({
      action: 'file_upload',
      severity: 'critical',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    FileAsset.aggregate([
      { $match: { isDeleted: false, courseId: { $ne: null } } },
      { $group: { _id: '$courseId', totalSize: { $sum: '$size' }, count: { $sum: 1 } } },
      { $sort: { totalSize: -1 } },
      { $limit: 10 },
    ]),
    FileAsset.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          size: { $sum: '$size' },
        },
      },
    ]),
  ]);

  const orphanReport = await detectOrphans({ limit: 50 });
  let blobRetentionMetrics = null;
  try {
    const blobRetention = require('./blobRetention.service');
    blobRetentionMetrics = await blobRetention.getRetentionMetrics();
  } catch {
    blobRetentionMetrics = null;
  }

  let previewJobMetrics = { ready: 0, failed: 0, pending: 0, corrupted: 0 };
  try {
    const PreviewManifest = require('../models/previewManifest.model');
    const [ready, failed, pending, corrupted] = await Promise.all([
      PreviewManifest.countDocuments({ status: 'ready' }),
      PreviewManifest.countDocuments({ status: 'failed' }),
      PreviewManifest.countDocuments({ status: 'pending' }),
      PreviewManifest.countDocuments({ previewCorrupted: true }),
    ]);
    previewJobMetrics = { ready, failed, pending, corrupted };
  } catch {
    previewJobMetrics = null;
  }

  const pendingQuarantine = await FileAsset.countDocuments({ cleanupState: 'PENDING_QUARANTINE' }).catch(
    () => 0
  );

  return {
    uploadPlatform: {
      previewJobs: previewJobMetrics,
      pendingQuarantineDeletes: pendingQuarantine,
      blobRetention: blobRetentionMetrics,
    },
    storage: {
      uploadsDirBytes: dirSizeBytes(paths.uploads),
      academicAssets: totalAssets,
    },
    integrity: {
      orphanCandidateCount: orphanCandidates,
      orphanDetectionSummary: orphanReport.summary,
      integrityFailureSignals: integrityFailures,
      blobMismatchEstimate:
        orphanReport.summary.missingBlobs + orphanReport.summary.missingDbRefs,
    },
    security: {
      suspiciousDownloadsLast7d: suspiciousDownloads,
      failedUploadsLast7d: failedUploads,
      unsafeFileCount: unsafeFiles,
    },
    versioning: {
      versionedFileCount: versionedFiles,
    },
    exportBlobCoverage: {
      byCategory: exportCoverage,
    },
    blobRetention: blobRetentionMetrics,
    largestCoursesByStorage: largestCourses.map((r) => ({
      courseId: String(r._id),
      bytes: r.totalSize,
      fileCount: r.count,
    })),
  };
}

module.exports = {
  getFileOpsMetrics,
};
