#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const { runFullVerification } = require('../services/verification/filePlatformVerification.service');
  const { report, jsonPath, txtPath } = await runFullVerification({
    includeRestoreParity: process.env.VERIFY_RESTORE_PARITY === 'true',
    bundleRoot: process.env.INSTITUTION_BUNDLE_PATH,
  });
  console.log(`Full verification: ${report.ok ? 'PASS' : 'FAIL'}`);
  console.log('JSON:', jsonPath);
  console.log('TXT:', txtPath);
  await mongoose.disconnect();
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
