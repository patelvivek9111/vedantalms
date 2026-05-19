#!/usr/bin/env node
/**
 * Export → validate → dry-run restore pipeline (Phase R8).
 * Usage: node scripts/verifyRestore.js [--sections=a,b]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { exportInstitutionBundle } = require('../services/export/institutionalExport.service');
const { restoreInstitutionBundle } = require('../services/import/institutionalImport.service');

async function main() {
  const sectionsArg = process.argv.find((a) => a.startsWith('--sections='));
  const sections = sectionsArg ? sectionsArg.split('=')[1].split(',') : undefined;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri);

  const exported = await exportInstitutionBundle({ sections, registerBackup: false });
  const report = await restoreInstitutionBundle(exported.directory, {
    validateOnly: true,
    dryRun: true,
  });

  console.log(
    JSON.stringify(
      {
        ok: report.integrity?.valid && report.ok !== false,
        batchId: exported.batchId,
        directory: exported.directory,
        sectionCount: exported.sections.length,
        restoreReport: report,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  process.exit(report.integrity?.valid ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
