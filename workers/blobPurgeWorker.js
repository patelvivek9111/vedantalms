#!/usr/bin/env node
/**
 * Nightly blob quarantine purge (U37F).
 * Cron: node workers/blobPurgeWorker.js [--apply]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const blobRetention = require('../services/blobRetention.service');
const bulkDownload = require('../services/bulkDownload.service');

async function main() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const purge = await blobRetention.purgeExpiredQuarantineBlobs({ dryRun: !apply });
  const zipClean = await bulkDownload.purgeExpiredZips({ dryRun: !apply });
  console.log(JSON.stringify({ purge, zipClean }, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
