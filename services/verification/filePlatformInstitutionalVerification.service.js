const fs = require('fs');
const path = require('path');
const { paths } = require('../../config/paths');
const { runFullVerification } = require('./filePlatformVerification.service');
const blobRetention = require('../blobRetention.service');
const bulkDownload = require('../bulkDownload.service');
const { getGovernanceReport } = require('../fileGovernanceEngine.service');
const PreviewManifest = require('../../models/previewManifest.model');

async function runInstitutionalVerification(options = {}) {
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

  const base = await runFullVerification(options);
  checks.push(...base.report.checks.map((c) => ({ ...c, suite: 'base' })));

  await push('blob_retention_metrics', () => blobRetention.getRetentionMetrics());
  await push('blob_restore_parity', () => blobRetention.verifyBlobRestoreParity(30));
  await push('zip_retention_dry', () => bulkDownload.purgeExpiredZips({ dryRun: true }));
  await push('governance_report', () => getGovernanceReport());
  await push('preview_manifest_health', async () => {
    const [ready, failed, pending] = await Promise.all([
      PreviewManifest.countDocuments({ status: 'ready' }),
      PreviewManifest.countDocuments({ status: 'failed' }),
      PreviewManifest.countDocuments({ status: 'pending' }),
    ]);
    return { ready, failed, pending };
  });

  if (options.bundleRoot) {
    await push('export_restore_parity', async () => {
      const { verifyBlobRestoreParity } = require('../import/blobRestore.service');
      return verifyBlobRestoreParity(options.bundleRoot);
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ok: checks.every((c) => c.ok),
    checks,
  };

  const outDir = path.join(paths.uploads, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'file-platform-institutional-report.json');
  const txtPath = path.join(outDir, 'file-platform-institutional-report.txt');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  const lines = [
    'Institutional File Platform Verification (U44F)',
    `Generated: ${report.generatedAt}`,
    `Overall: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
    ...checks.map((c) => `${c.ok ? 'OK' : 'FAIL'}  ${c.name} (${c.ms}ms)${c.error ? ` — ${c.error}` : ''}`),
  ];
  fs.writeFileSync(txtPath, lines.join('\n'));

  return { report, jsonPath, txtPath };
}

module.exports = { runInstitutionalVerification };
