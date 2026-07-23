/**
 * Backfill rootAccountId on course-child collections from Course.
 * Usage: node scripts/backfillCourseChildRootAccountId.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function stampFromCourse(Model, courseField = 'course') {
  const Course = mongoose.model('Course');
  const orphans = await Model.find({
    $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
  }).limit(5000);
  let ok = 0;
  for (const doc of orphans) {
    const courseId = doc[courseField] || doc.courseId;
    if (!courseId) continue;
    const course = await Course.findById(courseId).select('rootAccountId accountId').lean();
    if (!course?.rootAccountId) continue;
    await Model.updateOne(
      { _id: doc._id },
      { $set: { rootAccountId: course.rootAccountId, accountId: course.accountId || course.rootAccountId } }
    );
    ok += 1;
  }
  return { scanned: orphans.length, updated: ok };
}

async function stampViaModule(Model) {
  const Module = mongoose.model('Module');
  const Course = mongoose.model('Course');
  const orphans = await Model.find({
    $or: [{ rootAccountId: null }, { rootAccountId: { $exists: false } }],
    module: { $exists: true },
  }).limit(5000);
  let ok = 0;
  for (const doc of orphans) {
    const mod = await Module.findById(doc.module).select('course rootAccountId').lean();
    const root =
      mod?.rootAccountId ||
      (mod?.course
        ? (await Course.findById(mod.course).select('rootAccountId accountId').lean())?.rootAccountId
        : null);
    if (!root) continue;
    await Model.updateOne({ _id: doc._id }, { $set: { rootAccountId: root, accountId: root } });
    ok += 1;
  }
  return { scanned: orphans.length, updated: ok };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);

  // Ensure models load
  require('../models/course.model');
  require('../models/module.model');
  require('../models/Assignment');
  require('../models/Submission');
  require('../models/page.model');
  require('../models/thread.model');
  require('../models/announcement.model');
  require('../models/poll.model');
  require('../models/Group');
  require('../models/GroupSet');
  require('../models/attendance.model');
  require('../models/courseEnrollmentGrade.model');
  require('../models/todo.model');
  require('../models/event.model');

  const results = {};
  results.Module = await stampFromCourse(mongoose.model('Module'), 'course');
  results.Announcement = await stampFromCourse(mongoose.model('Announcement'), 'course');
  results.Thread = await stampFromCourse(mongoose.model('Thread'), 'course');
  results.Poll = await stampFromCourse(mongoose.model('Poll'), 'course');
  results.Group = await stampFromCourse(mongoose.model('Group'), 'course');
  results.GroupSet = await stampFromCourse(mongoose.model('GroupSet'), 'course');
  results.Attendance = await stampFromCourse(mongoose.model('Attendance'), 'course');
  results.CourseEnrollmentGrade = await stampFromCourse(
    mongoose.model('CourseEnrollmentGrade'),
    'course'
  );
  results.Todo = await stampFromCourse(mongoose.model('Todo'), 'courseId');
  results.Event = await stampFromCourse(mongoose.model('Event'), 'course');
  results.Assignment = await stampViaModule(mongoose.model('Assignment'));
  results.Page = await stampViaModule(mongoose.model('Page'));

  console.log(JSON.stringify(results, null, 2));
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
