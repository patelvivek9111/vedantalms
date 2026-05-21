#!/usr/bin/env node
/**
 * Register historical uploads as FileAsset rows without moving blobs.
 * Usage:
 *   node scripts/migrations/registerLegacyUploads.js [--dry-run] [--apply] [--resume=false]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runLegacyFileRegistration } = require('./lib/legacyFileRegistration');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dryRun = !apply;
const resume = !args.includes('--resume=false');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri);
  console.log(`Legacy file registration (${dryRun ? 'DRY RUN' : 'APPLY'})...`);

  const { report, reportPath } = await runLegacyFileRegistration({ dryRun, apply, resume });
  console.log('Report:', reportPath);
  console.log('Summary:', report);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
