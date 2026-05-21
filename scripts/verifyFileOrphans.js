#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { runOrphanVerification } = require('../services/fileCleanup.service');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms');
  const { report, reportPath } = await runOrphanVerification();
  console.log('Orphan report:', reportPath);
  console.log(JSON.stringify(report.summary, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
