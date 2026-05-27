#!/usr/bin/env node
/**
 * Roll back additive assignment workflow metadata.
 *
 * Dry-run by default. Use --apply to unset workflow hardening fields.
 * This intentionally preserves core submissions, grades, files, and transcript data.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const Course = require('../../models/course.model');
const migrationMetadata = require('../../services/migrationMetadata.service');

const apply = process.argv.includes('--apply');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const startedAt = Date.now();

  const assignmentFilter = {
    $or: [
      { gradeReleaseMode: { $exists: true } },
      { defaultGradeHidden: { $exists: true } },
      { lockAfterDue: { $exists: true } },
      { groupId: { $exists: true } },
    ],
  };
  const submissionFilter = {
    $or: [
      { attemptStartedAt: { $exists: true } },
      { attemptDeadlineAt: { $exists: true } },
      { attemptStatus: { $exists: true } },
      { lastHeartbeatAt: { $exists: true } },
      { gradesReleasedAt: { $exists: true } },
      { gradeHidden: { $exists: true } },
      { feedbackReleasedAt: { $exists: true } },
      { releaseRevision: { $exists: true } },
      { lastSubmitIdempotencyKey: { $exists: true } },
      { lastReleaseIdempotencyKey: { $exists: true } },
      { autoGradeExecutedAt: { $exists: true } },
      { autoGradeRunKey: { $exists: true } },
    ],
  };

  const courseFilter = { 'groups.id': { $exists: true } };
  const rowCounts = {
    assignmentsMatched: await Assignment.countDocuments(assignmentFilter),
    submissionsMatched: await Submission.countDocuments(submissionFilter),
    coursesMatched: await Course.countDocuments(courseFilter),
  };

  if (apply) {
    await Assignment.updateMany(assignmentFilter, {
      $unset: {
        gradeReleaseMode: '',
        defaultGradeHidden: '',
        lockAfterDue: '',
        groupId: '',
      },
    });
    await Submission.updateMany(submissionFilter, {
      $unset: {
        attemptStartedAt: '',
        attemptDeadlineAt: '',
        attemptStatus: '',
        lastHeartbeatAt: '',
        gradesReleasedAt: '',
        gradeHidden: '',
        feedbackReleasedAt: '',
        releaseRevision: '',
        lastSubmitIdempotencyKey: '',
        lastReleaseIdempotencyKey: '',
        autoGradeExecutedAt: '',
        autoGradeRunKey: '',
      },
    });
    await Course.updateMany(courseFilter, { $unset: { 'groups.$[].id': '' } });
  }

  const summary = {
    apply,
    rowCounts,
    mismatchReport: {},
    durationMs: Date.now() - startedAt,
  };
  await migrationMetadata.recordMigrationRun('rollback-assignment-workflow-fields', summary, {
    apply,
    rollbackAvailable: false,
    status: apply ? 'rolled_back' : 'previewed',
  });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
