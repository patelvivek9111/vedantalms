const fs = require('fs');
const path = require('path');
const { paths } = require('../config/paths');
const chunkedUpload = require('./chunkedUpload.service');

/**
 * U52F — reconcile orphaned chunk sessions and produce recovery report.
 */
async function reconcileUploadSessions({ dryRun = true } = {}) {
  chunkedUpload.cleanupExpiredSessions();
  const active = chunkedUpload.listActiveSessions();
  const chunkRoot = chunkedUpload.CHUNK_DIR;
  let orphanDirs = 0;
  let expiredSessions = 0;
  const issues = [];

  if (fs.existsSync(chunkRoot)) {
    for (const name of fs.readdirSync(chunkRoot)) {
      const dir = path.join(chunkRoot, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const known = active.find((s) => s.uploadId === name);
      if (!known) {
        orphanDirs += 1;
        if (!dryRun) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
        issues.push({ type: 'orphan_chunk_dir', uploadId: name });
      } else if (known.ageMs > chunkedUpload.SESSION_TTL_MS) {
        expiredSessions += 1;
        issues.push({ type: 'expired_session', uploadId: name });
      } else if (known.received < known.totalChunks) {
        issues.push({
          type: 'incomplete_session',
          uploadId: name,
          received: known.received,
          total: known.totalChunks,
        });
      }
    }
  }

  return {
    dryRun,
    activeSessions: active.length,
    orphanDirs,
    expiredSessions,
    incomplete: issues.filter((i) => i.type === 'incomplete_session').length,
    issues,
    ok: orphanDirs === 0 && expiredSessions === 0,
  };
}

async function writeUploadRecoveryReport(options = {}) {
  const report = await reconcileUploadSessions(options);
  const outDir = path.join(paths.uploads, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'upload-recovery-report.json');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)
  );
  return { report, jsonPath };
}

module.exports = {
  reconcileUploadSessions,
  writeUploadRecoveryReport,
};
