#!/usr/bin/env node
/**
 * Verify backup bundle restore compatibility (Phase R4).
 * Usage: node scripts/verifyBackupCompatibility.js <export-directory|backupId>
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  verifyBackupCompatibility,
  verifyBackupCompatibilityAsync,
} = require('../services/backup/backupManifest.service');

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/verifyBackupCompatibility.js <export-directory|backupId>');
    process.exit(1);
  }

  let result;
  const manifestPath = path.join(target, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    result = verifyBackupCompatibility(manifest);
    result.source = manifestPath;
  } else {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
    await mongoose.connect(uri);
    result = await verifyBackupCompatibilityAsync(target);
    await mongoose.disconnect();
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.compatible ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
