#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function main() {
  const bundleRoot = process.argv[2] || process.env.INSTITUTION_BUNDLE_PATH;
  const apply = process.argv.includes('--apply');
  if (!bundleRoot) {
    console.error('Usage: node scripts/restoreInstitutionBlobs.js <bundle-root> [--apply]');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const { restoreBlobsFromBundle } = require('../services/import/blobRestore.service');
  const report = await restoreBlobsFromBundle(path.resolve(bundleRoot), { dryRun: !apply, resume: true });
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(report.missing?.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
