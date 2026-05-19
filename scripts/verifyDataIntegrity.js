#!/usr/bin/env node
/**
 * Unified data integrity verification (Phase R3).
 * Usage: node scripts/verifyDataIntegrity.js [--export-dir=path]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  runDataIntegrityChecks,
  formatHumanReport,
} = require('../services/integrity/dataIntegrity.service');

async function main() {
  const exportDirArg = process.argv.find((a) => a.startsWith('--export-dir='));
  const options = {};
  if (exportDirArg) options.exportDir = exportDirArg.split('=')[1];

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri);

  const result = await runDataIntegrityChecks(options);
  const outDir = path.join(process.cwd(), 'uploads', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const jsonPath = path.join(outDir, `data-integrity-${stamp}.json`);
  const txtPath = path.join(outDir, `data-integrity-${stamp}.txt`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  fs.writeFileSync(txtPath, formatHumanReport(result));

  console.log(formatHumanReport(result));
  console.log(`\nJSON report: ${jsonPath}`);

  await mongoose.disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
