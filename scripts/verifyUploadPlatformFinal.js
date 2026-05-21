#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const { runUploadPlatformFinalVerification } = require('../services/verification/uploadPlatformFinalVerification.service');
  const { report, jsonPath, txtPath } = await runUploadPlatformFinalVerification({
    bundleRoot: process.env.INSTITUTION_BUNDLE_PATH,
  });
  console.log(`Upload platform final: ${report.ok ? 'PASS' : 'FAIL'}`);
  console.log(jsonPath);
  console.log(txtPath);
  await mongoose.disconnect();
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
