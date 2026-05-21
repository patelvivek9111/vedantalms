const fs = require('fs');
const path = require('path');
const { paths } = require('../../config/paths');
const { runUploadPlatformFinalVerification } = require('./uploadPlatformFinalVerification.service');
const { reconcileUploadSessions } = require('../uploadRecovery.service');
const chunkedUpload = require('../chunkedUpload.service');
const blobRetention = require('../blobRetention.service');
const { getGovernanceReport } = require('../fileGovernanceEngine.service');
const FileAsset = require('../../models/fileAsset.model');
const PreviewManifest = require('../../models/previewManifest.model');

function statusFromCheck(check) {
  if (check.ok === false) return 'FAIL';
  const r = check.result;
  if (r?.ok === false || r?.count > 0 && check.name === 'pending_quarantine_deletes') return 'WARN';
  if (check.name === 'upload_recovery' && r?.orphanDirs > 0) return 'WARN';
  return 'PASS';
}

/**
 * U55F — final upload production closure with PASS/WARN/FAIL per domain.
 */
async function runUploadProductionClosure(options = {}) {
  const domains = [];

  const record = (domain, checks) => {
    const statuses = checks.map((c) => c.status);
    const domainStatus = statuses.includes('FAIL')
      ? 'FAIL'
      : statuses.includes('WARN')
        ? 'WARN'
        : 'PASS';
    domains.push({ domain, status: domainStatus, checks });
  };

  const uploadRecovery = await reconcileUploadSessions({ dryRun: true });
  record('chunk_recovery', [
    {
      name: 'upload_session_reconciliation',
      status: uploadRecovery.ok ? 'PASS' : 'WARN',
      result: uploadRecovery,
    },
    {
      name: 'chunk_api_available',
      status: typeof chunkedUpload.initSession === 'function' ? 'PASS' : 'FAIL',
      result: { chunkSize: chunkedUpload.DEFAULT_CHUNK_SIZE },
    },
  ]);

  const final = await runUploadPlatformFinalVerification(options);
  const grouped = {
    integrity: [],
    preview: [],
    recovery: [],
    governance: [],
    portability: [],
  };

  for (const c of final.report.checks) {
    const st = c.ok === false ? 'FAIL' : 'PASS';
    const entry = { name: c.name, status: st, ms: c.ms, error: c.error, suite: c.suite };
    if (/preview/i.test(c.name)) grouped.preview.push(entry);
    else if (/quarantine|blob|orphan|restore/i.test(c.name)) grouped.recovery.push(entry);
    else if (/governance|legal|ferpa/i.test(c.name)) grouped.governance.push(entry);
    else if (/export|portability|syllabus/i.test(c.name)) grouped.portability.push(entry);
    else grouped.integrity.push(entry);
  }

  record('integrity', grouped.integrity);
  record('preview', grouped.preview);
  record('recovery', grouped.recovery);
  record('governance', grouped.governance);
  record('portability', grouped.portability);

  let govReport = null;
  try {
    govReport = await getGovernanceReport();
    record('governance_deep', [
      { name: 'governance_report', status: 'PASS', result: { legalHoldCount: govReport.legalHoldCount } },
    ]);
  } catch (e) {
    record('governance_deep', [
      { name: 'governance_report', status: 'FAIL', error: e.message },
    ]);
  }

  const pendingQ = await FileAsset.countDocuments({ cleanupState: 'PENDING_QUARANTINE' });
  record('upload_governance', [
    {
      name: 'pending_quarantine_deletes',
      status: pendingQ === 0 ? 'PASS' : 'WARN',
      result: { count: pendingQ },
    },
    {
      name: 'blob_restore_parity',
      status: (await blobRetention.verifyBlobRestoreParity(30)).ok ? 'PASS' : 'WARN',
      result: await blobRetention.verifyBlobRestoreParity(30),
    },
  ]);

  const overallStatus = domains.some((d) => d.status === 'FAIL')
    ? 'FAIL'
    : domains.some((d) => d.status === 'WARN')
      ? 'WARN'
      : 'PASS';

  const report = {
    generatedAt: new Date().toISOString(),
    phase: 'U55F-upload-production-closure',
    status: overallStatus,
    domains,
    institutionalChecks: final.report.checks.length,
  };

  const outDir = path.join(paths.uploads, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'upload-production-closure-report.json');
  const txtPath = path.join(outDir, 'upload-production-closure-report.txt');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  const lines = [
    'Upload Production Closure (U55F)',
    `Generated: ${report.generatedAt}`,
    `Overall: ${overallStatus}`,
    '',
    ...domains.flatMap((d) => [
      `[${d.status}] ${d.domain}`,
      ...d.checks.map((c) => `  ${c.status}  ${c.name}${c.error ? ` — ${c.error}` : ''}`),
      '',
    ]),
  ];
  fs.writeFileSync(txtPath, lines.join('\n'));

  return { report, jsonPath, txtPath };
}

module.exports = { runUploadProductionClosure, statusFromCheck };
