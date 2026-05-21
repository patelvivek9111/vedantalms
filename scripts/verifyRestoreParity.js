#!/usr/bin/env node
/**
 * Compare institution export manifest vs live DB counts (post-restore parity smoke).
 * Usage: node scripts/verifyRestoreParity.js [--export-dir path]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const FileAsset = require('../models/fileAsset.model');
const Course = require('../models/course.model');

async function main() {
  const exportDir = process.argv.includes('--export-dir')
    ? process.argv[process.argv.indexOf('--export-dir') + 1]
    : null;

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');

  const live = {
    courses: await Course.countDocuments(),
    fileAssets: await FileAsset.countDocuments({ isDeleted: false }),
  };

  let exportCounts = null;
  if (exportDir && fs.existsSync(exportDir)) {
    const manifestPath = path.join(exportDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      exportCounts = manifest.counts || manifest.sections || null;
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    live,
    exportCounts,
    parityOk: !exportCounts || (exportCounts.fileAssets <= live.fileAssets),
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(report.parityOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
