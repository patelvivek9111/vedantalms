#!/usr/bin/env node
/**
 * Remove DB rows tied to course IDs that no longer exist (e.g. after manual deletes).
 * Usage: node scripts/ops/prune-orphan-course-data.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { pruneOrphanCourseData } = require('../../services/courseDeleteCascade.service');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms';
  await mongoose.connect(uri);
  const report = await pruneOrphanCourseData();
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
