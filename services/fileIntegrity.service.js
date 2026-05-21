const fs = require('fs');
const path = require('path');
const FileAsset = require('../models/fileAsset.model');
const Course = require('../models/course.model');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const { resolveLocalPathFromUrl } = require('../utils/fileBlobUtils');
const { writeReport, formatHumanSummary } = require('../utils/fileReports');
const { getStorageService } = require('./storage');
const { assertSafeForDownload } = require('./fileScan.service');

async function verifyBlobExists(asset) {
  if (asset.metadata?.providerUrl?.includes('cloudinary.com')) {
    try {
      const res = await fetch(asset.metadata.providerUrl, { method: 'HEAD' });
      return { ok: res.ok, provider: 'cloudinary' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  const local =
    resolveLocalPathFromUrl(asset.path) || path.join(require('../config/paths').paths.uploads, asset.storageKey);
  return { ok: fs.existsSync(local), path: local, provider: asset.provider };
}

async function runFileIntegrityCheck(options = {}) {
  const limit = options.limit || 5000;
  const assets = await FileAsset.find({ isDeleted: false }).limit(limit).lean();
  const failures = [];
  let verified = 0;

  for (const asset of assets) {
    verified++;
    const issues = [];

    if (!asset.storageKey) issues.push('missing_storage_key');
    if (!asset.uploadedBy) issues.push('missing_uploaded_by');

    if (asset.courseId) {
      const course = await Course.findById(asset.courseId).select('_id').lean();
      if (!course) issues.push('broken_course_reference');
    }
    if (asset.submissionId) {
      const sub = await Submission.findById(asset.submissionId).select('_id').lean();
      if (!sub) issues.push('broken_submission_reference');
    }
    if (asset.assignmentId) {
      const asn = await Assignment.findById(asset.assignmentId).select('_id').lean();
      if (!asn) issues.push('broken_assignment_reference');
    }

    if (asset.supersedes) {
      const prev = await FileAsset.findById(asset.supersedes).lean();
      if (!prev) issues.push('broken_supersedes_chain');
      else if (prev.supersededBy && String(prev.supersededBy) !== String(asset._id)) {
        issues.push('version_chain_mismatch');
      }
    }

    try {
      assertSafeForDownload(asset);
    } catch {
      issues.push('unsafe_scan_status');
    }

    const blob = await verifyBlobExists(asset);
    if (!blob.ok) issues.push('blob_missing');

    if (asset.checksumSha256 && blob.ok && blob.path) {
      const { sha256File } = require('../utils/fileBlobUtils');
      try {
        const { checksum } = sha256File(blob.path);
        if (checksum !== asset.checksumSha256) issues.push('checksum_drift');
      } catch {
        issues.push('checksum_compute_failed');
      }
    }

    if (issues.length) {
      failures.push({
        fileAssetId: String(asset._id),
        storageKey: asset.storageKey,
        category: asset.category,
        issues,
      });
    }
  }

  let providerReachable = true;
  try {
    getStorageService();
  } catch (e) {
    providerReachable = false;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      verified,
      failureCount: failures.length,
      providerReachable,
      passRate: verified ? Number((((verified - failures.length) / verified) * 100).toFixed(2)) : 100,
    },
    failures: failures.slice(0, options.failureLimit || 200),
  };

  const jsonPath = writeReport('file-integrity-report.json', report);
  const human = formatHumanSummary('File Integrity Report', report.summary);
  fs.writeFileSync(jsonPath.replace('.json', '.txt'), human, 'utf8');

  return { report, reportPath: jsonPath };
}

module.exports = {
  verifyBlobExists,
  runFileIntegrityCheck,
};
