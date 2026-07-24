#!/usr/bin/env node
/**
 * SIS scheduled sync worker — honors SisIntegrationConfig.schedule (hourly / nightly).
 * Cron examples:
 *   0 * * * *  node workers/sisSyncWorker.js --apply
 *   0 2 * * *  node workers/sisSyncWorker.js --apply
 * Dry-run (no HTTP pull/push writes): omit --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runDueScheduledSyncs } = require('../services/registrar/sisSyncRunner.service');

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const report = await runDueScheduledSyncs({ dryRun: !apply });
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  const failed = (report.reports || []).some((r) => r.ok === false);
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
