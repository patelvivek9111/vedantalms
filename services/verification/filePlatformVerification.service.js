const fs = require('fs');
const path = require('path');
const { paths } = require('../../config/paths');
const { detectOrphans } = require('../fileCleanup.service');
const { runBlobReconciliation } = require('../blobReconciliation.service');
const { runFileIntegrityCheck } = require('../fileIntegrity.service');
const { getQuotaSnapshot } = require('../fileQuota.service');
const FileAsset = require('../../models/fileAsset.model');

async function runFullVerification(options = {}) {
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

  await push('orphan_detection', () => detectOrphans({ limit: 100 }));
  await push('blob_reconciliation', async () => {
    const { report } = await runBlobReconciliation({ sampleLimit: 50 });
    return report?.summary;
  });
  await push('checksum_integrity', async () => {
    const { report } = await runFileIntegrityCheck({ sampleLimit: 50 });
    return report?.summary;
  });
  await push('quota_snapshot', () => getQuotaSnapshot(null, null));
  await push('version_graph', async () => {
    const broken = await FileAsset.countDocuments({
      isDeleted: false,
      versionGroupId: { $ne: '' },
      isCurrentVersion: true,
    });
    return { currentVersionRows: broken };
  });
  await push('quarantine_consistency', async () => {
    const unsafe = await FileAsset.countDocuments({ scanStatus: 'unsafe', isDeleted: false });
    const locked = await FileAsset.countDocuments({ scanStatus: 'unsafe', lifecycleLocked: true });
    return { unsafe, locked, consistent: unsafe === locked };
  });
  await push('preview_metadata', async () => {
    const withPreview = await FileAsset.countDocuments({ 'metadata.previewGeneratedAt': { $exists: true } });
    return { withPreview };
  });

  if (options.includeRestoreParity) {
    await push('restore_parity', async () => {
      const { verifyBlobRestoreParity } = require('../import/blobRestore.service');
      const bundle = options.bundleRoot;
      if (!bundle) return { skipped: true };
      return verifyBlobRestoreParity(bundle);
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ok: checks.every((c) => c.ok),
    checks,
  };

  const outDir = path.join(paths.uploads, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'file-platform-full-report.json');
  const txtPath = path.join(outDir, 'file-platform-full-report.txt');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  const lines = [
    'File Platform Full Verification',
    `Generated: ${report.generatedAt}`,
    `Overall: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
    ...checks.map((c) => `${c.ok ? 'OK' : 'FAIL'}  ${c.name} (${c.ms}ms)${c.error ? ` — ${c.error}` : ''}`),
  ];
  fs.writeFileSync(txtPath, lines.join('\n'));

  return { report, jsonPath, txtPath };
}

module.exports = { runFullVerification };
