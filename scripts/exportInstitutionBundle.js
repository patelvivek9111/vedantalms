#!/usr/bin/env node
/**
 * Export full institution portable bundle (Phase R1).
 * Usage: node scripts/exportInstitutionBundle.js [--sections=a,b] [--batch-id=id] [--resume]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { exportInstitutionBundle } = require('../services/export/institutionalExport.service');

function parseArgs(argv) {
  const options = { resume: true, registerBackup: true };
  for (const arg of argv) {
    if (arg.startsWith('--sections=')) {
      options.sections = arg.split('=')[1].split(',').map((s) => s.trim());
    } else if (arg.startsWith('--batch-id=')) {
      options.batchId = arg.split('=')[1];
    } else if (arg === '--no-resume') options.resume = false;
    else if (arg === '--no-register-backup') options.registerBackup = false;
    else if (arg.startsWith('--institution-id=')) {
      options.institutionId = arg.split('=')[1];
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri);

  const result = await exportInstitutionBundle(options);
  console.log(
    JSON.stringify(
      {
        ok: true,
        batchId: result.batchId,
        directory: result.directory,
        sectionCount: result.sections.length,
        checksum: result.manifest.checksum,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
