#!/usr/bin/env node
/**
 * Snapshot consistency checker — frozen rows, isCurrent uniqueness, lifecycle alignment.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const StudentCourseGradeSnapshot = require('../models/studentCourseGradeSnapshot.model');
const CourseGradeLifecycle = require('../models/courseGradeLifecycle.model');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  await mongoose.connect(uri, { dbName: 'lms' });

  const issues = [];

  const dupCurrent = await StudentCourseGradeSnapshot.aggregate([
    { $match: { isCurrent: true, term: { $type: 'string' }, year: { $type: 'number' } } },
    {
      $group: {
        _id: { student: '$student', course: '$course', term: '$term', year: '$year' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 50 },
  ]);

  if (dupCurrent.length) {
    issues.push({ type: 'duplicate_is_current', samples: dupCurrent });
  }

  const finalized = await CourseGradeLifecycle.find({ status: 'FINALIZED' }).lean();
  for (const lc of finalized) {
    const count = await StudentCourseGradeSnapshot.countDocuments({
      course: lc.course,
      term: lc.term,
      year: lc.year,
      frozen: true,
      isCurrent: true,
    });
    if (count === 0 && (lc.studentSnapshotCount || 0) > 0) {
      issues.push({
        type: 'finalized_without_current_snapshots',
        lifecycleId: String(lc._id),
        expected: lc.studentSnapshotCount,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: issues.length === 0,
        finalizedLifecycleRows: finalized.length,
        issues,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
