#!/usr/bin/env node
/**
 * U29F — verify syllabus FileAsset linkage.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Course = require('../models/course.model');
const FileAsset = require('../models/fileAsset.model');
const { paths } = require('../config/paths');
const { extractFileAssetIdFromUrl } = require('../services/syllabusFiles.service');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const courses = await Course.find({ 'catalog.syllabusFiles.0': { $exists: true } }).lean();
  const report = {
    coursesWithSyllabusFiles: courses.length,
    entriesTotal: 0,
    withFileAssetId: 0,
    urlOnly: 0,
    brokenRefs: [],
    ok: true,
  };

  for (const course of courses) {
    for (const entry of course.catalog?.syllabusFiles || []) {
      report.entriesTotal += 1;
      const id = entry.fileAssetId || extractFileAssetIdFromUrl(entry.url);
      if (entry.fileAssetId) report.withFileAssetId += 1;
      else if (entry.url) report.urlOnly += 1;
      if (id) {
        const asset = await FileAsset.findById(id).select('isDeleted category').lean();
        if (!asset || asset.isDeleted) {
          report.brokenRefs.push({ courseId: course._id, fileAssetId: id });
          report.ok = false;
        }
      } else if (entry.url) {
        report.brokenRefs.push({ courseId: course._id, url: entry.url, reason: 'no_file_asset_id' });
      }
    }
  }

  const outDir = path.join(paths.uploads, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'syllabus-fileassets-verify.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
