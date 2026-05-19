#!/usr/bin/env node
/**
 * Restore institution bundle with safe staged import (Phase R2).
 *
 * Usage:
 *   node scripts/restoreInstitutionBundle.js <export-directory> [options]
 *
 * Options:
 *   --dry-run           Simulate without writes
 *   --validate-only     Validate manifest + referential checks only
 *   --merge             Update existing non-finalized records
 *   --skip-existing     Skip documents that already exist (default)
 *   --remap-ids         Generate new ObjectIds and maintain mapping
 *   --sections=a,b      Partial restore
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { restoreInstitutionBundle } = require('../services/import/institutionalImport.service');

function parseArgs(argv) {
  const exportDir = argv.find((a) => !a.startsWith('--'));
  const options = {
    dryRun: argv.includes('--dry-run'),
    validateOnly: argv.includes('--validate-only'),
    merge: argv.includes('--merge'),
    skipExisting: argv.includes('--skip-existing') || !argv.includes('--merge'),
    remapIds: argv.includes('--remap-ids'),
  };
  const sectionsArg = argv.find((a) => a.startsWith('--sections='));
  if (sectionsArg) options.sections = sectionsArg.split('=')[1].split(',').map((s) => s.trim());
  return { exportDir, options };
}

async function main() {
  const { exportDir, options } = parseArgs(process.argv.slice(2));
  if (!exportDir) {
    console.error(
      'Usage: node scripts/restoreInstitutionBundle.js <export-directory> [--dry-run] [--validate-only] [--merge] [--skip-existing] [--remap-ids]'
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri);

  const report = await restoreInstitutionBundle(exportDir, options);
  console.log(JSON.stringify(report, null, 2));

  await mongoose.disconnect();
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
