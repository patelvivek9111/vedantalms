#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const { runUploadProductionClosure } = require('../services/verification/uploadProductionClosure.service');
  const { report, jsonPath, txtPath } = await runUploadProductionClosure({
    bundleRoot: process.env.INSTITUTION_BUNDLE_PATH,
  });
  console.log(`Upload production closure: ${report.status}`);
  console.log(jsonPath);
  console.log(txtPath);
  await mongoose.disconnect();
  process.exit(report.status === 'FAIL' ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
