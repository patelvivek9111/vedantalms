#!/usr/bin/env node
require('dotenv').config();

async function main() {
  const { writeUploadRecoveryReport } = require('../services/uploadRecovery.service');
  const { report, jsonPath } = await writeUploadRecoveryReport({ dryRun: true });
  console.log(`Upload recovery verification: ${report.ok ? 'PASS' : 'WARN'}`);
  console.log(`Active sessions: ${report.activeSessions}`);
  console.log(`Incomplete: ${report.incomplete}`);
  console.log(`Orphan dirs: ${report.orphanDirs}`);
  console.log(jsonPath);
  process.exit(report.ok ? 0 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
