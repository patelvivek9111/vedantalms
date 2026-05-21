#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { runBlobReconciliation } = require('../services/blobReconciliation.service');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms');
  const { report, reportPath } = await runBlobReconciliation();
  console.log('Reconciliation report:', reportPath);
  console.log(JSON.stringify(report.summary, null, 2));
  const issues =
    report.summary.dbWithoutBlob +
    report.summary.blobWithoutDb +
    report.summary.checksumDrift;
  process.exit(issues > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
