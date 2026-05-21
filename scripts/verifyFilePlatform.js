#!/usr/bin/env node
/**
 * U28F — institutional file platform verification.
 * Runs integrity, reconciliation, orphan, quota, scan, and restore checks.
 * Output: uploads/reports/file-platform-report.json
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { paths } = require('../config/paths');

const REPORT_DIR = path.join(paths.uploads, 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'file-platform-report.json');

async function runCheck(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    return { name, ok: true, ms: Date.now() - started, result };
  } catch (err) {
    return {
      name,
      ok: false,
      ms: Date.now() - started,
      error: err.message || String(err),
    };
  }
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms';
  await mongoose.connect(mongoUri);

  const checks = [];

  checks.push(
    await runCheck('file_integrity', async () => {
      const { runFileIntegrityCheck } = require('../services/fileIntegrity.service');
      const { report } = await runFileIntegrityCheck({ sampleLimit: 50 });
      return report?.summary || report;
    })
  );

  checks.push(
    await runCheck('blob_reconciliation', async () => {
      const { runBlobReconciliation } = require('../services/blobReconciliation.service');
      const { report } = await runBlobReconciliation({ sampleLimit: 50 });
      return report?.summary || report;
    })
  );

  checks.push(
    await runCheck('orphan_detection', async () => {
      const { detectOrphans } = require('../services/fileCleanup.service');
      return detectOrphans({ limit: 50 });
    })
  );

  checks.push(
    await runCheck('file_ops_metrics', async () => {
      const { getFileOpsMetrics } = require('../services/fileOpsMetrics.service');
      return getFileOpsMetrics();
    })
  );

  checks.push(
    await runCheck('quota_snapshot', async () => {
      const fileQuotaService = require('../services/fileQuota.service');
      return fileQuotaService.getQuotaSettings();
    })
  );

  checks.push(
    await runCheck('scan_adapter', async () => {
      const clamav = require('../adapters/scan/clamavAdapter');
      return { enabled: clamav.isEnabled(), config: clamav.getConfig() };
    })
  );

  checks.push(
    await runCheck('retention_settings', async () => {
      const fileRetention = require('../services/fileRetention.service');
      return fileRetention.getRetentionSettings();
    })
  );

  if (process.env.VERIFY_RESTORE_PARITY === 'true') {
    checks.push(
      await runCheck('restore_parity', async () => {
        const { execSync } = require('child_process');
        execSync('node scripts/verifyRestoreParity.js', { stdio: 'pipe', encoding: 'utf8' });
        return { ran: true };
      })
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ok: checks.every((c) => c.ok),
    checks,
  };

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  await mongoose.disconnect();
  console.log(`File platform report: ${report.ok ? 'PASS' : 'FAIL'} → ${REPORT_PATH}`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
