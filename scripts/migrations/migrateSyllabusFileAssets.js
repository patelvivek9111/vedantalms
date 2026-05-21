#!/usr/bin/env node
/**
 * U29F — migrate syllabus catalog URLs to fileAssetId references.
 * Usage: node scripts/migrations/migrateSyllabusFileAssets.js [--apply]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { paths } = require('../../config/paths');
const { migrateLegacySyllabusUrls } = require('../../services/syllabusFiles.service');

async function main() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const report = await migrateLegacySyllabusUrls({ dryRun: !apply, limit: 5000 });
  const outDir = path.join(paths.uploads, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'syllabus-fileassets-migration.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(apply ? 'Applied' : 'Dry-run', 'syllabus migration →', outPath);
  console.log(JSON.stringify({ scanned: report.scanned, migrated: report.migrated, unresolved: report.unresolved.length }, null, 2));
  await mongoose.disconnect();
  process.exit(report.unresolved.length && !apply ? 0 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
