/**
 * Backfill Canvas-style materialized dashboard grade summaries for all courses.
 *
 * Usage: node scripts/backfillDashboardGradeSummaries.js [--courseId=<id>] [--limit=N]
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Course = require('../models/course.model');
const { recomputeEntireCourse } = require('../services/dashboardGradeSummary.service');

function parseArgs(argv) {
  const options = { courseId: null, limit: null };
  for (const arg of argv) {
    if (arg.startsWith('--courseId=')) {
      options.courseId = arg.slice('--courseId='.length);
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.slice('--limit='.length), 10);
    }
  }
  return options;
}

async function main() {
  const { courseId, limit } = parseArgs(process.argv.slice(2));
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

  await mongoose.connect(mongoUri, {
    dbName: 'lms',
    maxPoolSize: 10,
  });

  const query = courseId ? { _id: courseId } : { 'students.0': { $exists: true } };
  let cursor = Course.find(query).select('_id title students').sort({ updatedAt: -1 });
  if (limit && Number.isFinite(limit)) {
    cursor = cursor.limit(limit);
  }

  const courses = await cursor.lean();
  console.log(`Backfilling dashboard grade summaries for ${courses.length} course(s)...`);

  let processed = 0;
  for (const course of courses) {
    const studentCount = (course.students || []).length;
    if (!studentCount) continue;
    process.stdout.write(`  ${course.title || course._id} (${studentCount} students)... `);
    try {
      await recomputeEntireCourse(course._id);
      processed += 1;
      console.log('ok');
    } catch (err) {
      console.log('failed');
      console.error(err);
    }
  }

  console.log(`Done. ${processed}/${courses.length} courses updated.`);
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
