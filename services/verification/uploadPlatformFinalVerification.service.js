const fs = require('fs');
const path = require('path');
const { paths } = require('../../config/paths');
const { runInstitutionalVerification } = require('./filePlatformInstitutionalVerification.service');
const blobRetention = require('../blobRetention.service');
const bulkDownload = require('../bulkDownload.service');
const { getFileOpsMetrics } = require('../fileOpsMetrics.service');
const PreviewManifest = require('../../models/previewManifest.model');
const FileAsset = require('../../models/fileAsset.model');

/**
 * U50F — consolidated upload platform production closure verification.
 */
async function runUploadPlatformFinalVerification(options = {}) {
  const checks = [];
  const push = async (name, fn) => {
    const started = Date.now();
    try {
      const result = await fn();
      checks.push({ name, ok: true, ms: Date.now() - started, result });
    } catch (err) {
      checks.push({ name, ok: false, ms: Date.now() - started, error: err.message });
    }
  };

  const institutional = await runInstitutionalVerification(options);
  checks.push(
    ...institutional.report.checks.map((c) => ({
      ...c,
      suite: 'institutional',
    }))
  );

  await push('upload_ops_metrics', () => getFileOpsMetrics());
  await push('blob_retention_parity', () => blobRetention.verifyBlobRestoreParity(100));
  await push('zip_retention', () => bulkDownload.purgeExpiredZips({ dryRun: true }));
  await push('quarantine_purge_simulation', () => blobRetention.purgeExpiredQuarantineBlobs({ dryRun: true }));
  await push('preview_health', async () => {
    const [ready, failed, corrupted, pending] = await Promise.all([
      PreviewManifest.countDocuments({ status: 'ready' }),
      PreviewManifest.countDocuments({ status: 'failed' }),
      PreviewManifest.countDocuments({ previewCorrupted: true }),
      PreviewManifest.countDocuments({ status: 'pending' }),
    ]);
    return { ready, failed, corrupted, pending };
  });
  await push('pending_quarantine_deletes', async () => {
    const count = await FileAsset.countDocuments({ cleanupState: 'PENDING_QUARANTINE' });
    return { count, ok: count === 0 };
  });
  await push('storage_drift_estimate', async () => {
    const total = await FileAsset.countDocuments({ isDeleted: false });
    const unsafe = await FileAsset.countDocuments({ scanStatus: 'unsafe', isDeleted: false });
    return { activeAssets: total, unsafeActive: unsafe };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    ok: checks.every((c) => c.ok),
    phase: 'U50F-upload-platform-final',
    checks,
  };

  const outDir = path.join(paths.uploads, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'upload-platform-final-report.json');
  const txtPath = path.join(outDir, 'upload-platform-final-report.txt');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  const lines = [
    'Upload Platform Final Verification (U50F)',
    `Generated: ${report.generatedAt}`,
    `Overall: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
    ...checks.map(
      (c) => `${c.ok ? 'OK' : 'FAIL'}  ${c.name}${c.suite ? ` [${c.suite}]` : ''} (${c.ms}ms)${c.error ? ` — ${c.error}` : ''}`
    ),
  ];
  fs.writeFileSync(txtPath, lines.join('\n'));

  return { report, jsonPath, txtPath };
}

module.exports = { runUploadPlatformFinalVerification };
