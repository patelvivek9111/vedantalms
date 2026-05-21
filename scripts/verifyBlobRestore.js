#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function main() {
  const bundleRoot = process.argv[2] || process.env.INSTITUTION_BUNDLE_PATH;
  if (!bundleRoot) {
    console.error('Usage: node scripts/verifyBlobRestore.js <bundle-root>');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const { verifyBlobRestoreParity } = require('../services/import/blobRestore.service');
  const report = await verifyBlobRestoreParity(path.resolve(bundleRoot));
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
