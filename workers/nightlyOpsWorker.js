#!/usr/bin/env node
/**
 * Nightly ops maintenance — inbox unread repair + notification visibility reconcile.
 * Cron: 0 3 * * * node workers/nightlyOpsWorker.js --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runNightlyOpsBundle } = require('../services/nightlyOps.service');

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const report = await runNightlyOpsBundle({ apply });
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
