#!/usr/bin/env node
/**
 * Admin-safe grade release recovery utility.
 *
 * Dry-run by default.
 * Examples:
 *   node scripts/ops/recoverGradeRelease.js --assignment <id> --release
 *   node scripts/ops/recoverGradeRelease.js --assignment <id> --hide --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Submission = require('../../models/Submission');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const release = args.includes('--release');
const hide = args.includes('--hide');
const assignmentId = args[args.indexOf('--assignment') + 1];
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  if (!assignmentId || release === hide) {
    throw new Error('Use --assignment <id> with exactly one of --release or --hide.');
  }
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const filter = { assignment: assignmentId };
  const matched = await Submission.countDocuments(filter);
  let modified = 0;
  if (apply) {
    const update = release
      ? {
          $set: { gradesReleasedAt: new Date(), gradeHidden: false },
          $inc: { releaseRevision: 1 },
        }
      : {
          $unset: { gradesReleasedAt: '', feedbackReleasedAt: '' },
          $set: { gradeHidden: true },
          $inc: { releaseRevision: 1 },
        };
    const result = await Submission.updateMany(filter, update);
    modified = result.modifiedCount || 0;
  }
  console.log(JSON.stringify({ apply, assignmentId, action: release ? 'release' : 'hide', matched, modified }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
