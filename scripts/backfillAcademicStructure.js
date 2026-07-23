/**
 * Backfill AcademicTerm / CourseOffering / CourseSection for existing Courses.
 * Usage: node scripts/backfillAcademicStructure.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { ensureDefaultRootAccount } = require('../services/tenancy/ensureDefaultRootAccount.service');
const { ensureOfferingAndSectionForCourse } = require('../services/tenancy/academicStructure.service');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);

  require('../models/course.model');
  require('../models/academicTerm.model');
  require('../models/courseOffering.model');
  require('../models/courseSection.model');

  await ensureDefaultRootAccount();
  const Course = mongoose.model('Course');
  const courses = await Course.find({ rootAccountId: { $ne: null } }).limit(5000);
  let ok = 0;
  let fail = 0;
  for (const course of courses) {
    try {
      await ensureOfferingAndSectionForCourse(course);
      ok += 1;
    } catch (err) {
      fail += 1;
      console.warn(`Course ${course._id}: ${err.message}`);
    }
  }
  console.log(`Backfill done: ok=${ok} fail=${fail}`);
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
