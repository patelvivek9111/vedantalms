/**
 * Backfill Enrollment of record from Course.students[].
 * Usage: node scripts/backfillEnrollmentsFromCourses.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { ensureDefaultRootAccount } = require('../services/tenancy/ensureDefaultRootAccount.service');
const { syncEnrollmentsFromCourseStudents } = require('../services/registrar/enrollmentWrite.service');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);

  require('../models/course.model');
  require('../models/enrollment.model');
  require('../models/studentHold.model');

  await ensureDefaultRootAccount();
  const Course = mongoose.model('Course');
  const courses = await Course.find({
    rootAccountId: { $ne: null },
    students: { $exists: true, $ne: [] },
  }).limit(5000);

  let ok = 0;
  let fail = 0;
  let synced = 0;
  for (const course of courses) {
    try {
      const rows = await syncEnrollmentsFromCourseStudents(course);
      synced += rows.length;
      ok += 1;
    } catch (err) {
      fail += 1;
      console.warn(`Course ${course._id}: ${err.message}`);
    }
  }
  console.log(`Backfill done: courses_ok=${ok} courses_fail=${fail} enrollments_upserted=${synced}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
