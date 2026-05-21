#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { runFileIntegrityCheck } = require('../services/fileIntegrity.service');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms');
  const { report, reportPath } = await runFileIntegrityCheck();
  console.log('Integrity report:', reportPath);
  console.log(JSON.stringify(report.summary, null, 2));
  await mongoose.disconnect();
  process.exit(report.summary.failureCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
