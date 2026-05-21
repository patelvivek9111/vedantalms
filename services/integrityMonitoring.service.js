const fs = require('fs');
const path = require('path');
const FileAsset = require('../models/fileAsset.model');
const { paths } = require('../config/paths');
const { detectOrphans } = require('./fileCleanup.service');
const { getFileOpsMetrics } = require('./fileOpsMetrics.service');
const academicAuditService = require('./academicAudit.service');

const REPORT_DIR = path.join(paths.fileReports || path.join(process.cwd(), 'uploads', 'reports'), 'integrity');

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
}

async function runIntegrityReport() {
  ensureReportDir();
  const [fileMetrics, orphanReport, integritySignals, unsafeCount] = await Promise.all([
    getFileOpsMetrics(),
    detectOrphans({ limit: 100 }),
    FileAsset.countDocuments({
      isDeleted: false,
      $or: [{ checksumSha256: '' }, { storageKey: '' }],
    }),
    FileAsset.countDocuments({ scanStatus: 'unsafe', isDeleted: false }),
  ]);

  let snapshotDrift = null;
  try {
    const { verifySnapshots } = require('../scripts/verifySnapshots');
    snapshotDrift = { note: 'Run npm run verify:snapshots for full transcript snapshot audit' };
  } catch {
    snapshotDrift = { skipped: true };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    fileMetrics,
    orphanReport: orphanReport.summary,
    integritySignals,
    unsafeCount,
    snapshotDrift,
    status: integritySignals > 0 || unsafeCount > 0 ? 'warning' : 'ok',
  };

  const outPath = path.join(REPORT_DIR, `integrity-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  await academicAuditService.recordAuditEvent({
    actorId: null,
    entityType: 'system',
    entityId: 'integrity_monitor',
    action: 'integrity_report_generated',
    severity: report.status === 'ok' ? 'info' : 'warning',
    metadata: { path: outPath, integritySignals, unsafeCount },
  }).catch(() => {});

  return { report, path: outPath };
}

module.exports = {
  runIntegrityReport,
  REPORT_DIR,
};
