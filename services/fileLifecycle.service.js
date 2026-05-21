const Course = require('../models/course.model');
const Assignment = require('../models/Assignment');
const Module = require('../models/module.model');
const GroupSet = require('../models/GroupSet');
const gradeLifecycleService = require('./gradeLifecycle.service');
const { getSemesterFromCourse } = require('../utils/semesterUtils');
const { FINALIZED_STATUSES } = require('./gradeLifecycle.service');

async function resolveCourseForAssignment(assignmentId) {
  const assignment = await Assignment.findById(assignmentId)
    .select('module groupSet isGroupAssignment')
    .lean();
  if (!assignment) return null;
  if (assignment.module) {
    const mod = await Module.findById(assignment.module).select('course').lean();
    if (mod?.course) return Course.findById(mod.course);
  }
  if (assignment.groupSet) {
    const gs = await GroupSet.findById(assignment.groupSet).select('course').lean();
    if (gs?.course) return Course.findById(gs.course);
  }
  return null;
}

function assertCourseOperational(course, { action = 'mutate' } = {}) {
  if (!course) return;
  if (course.operationalStatus === 'archived') {
    const err = new Error(
      `Course is archived and read-only. Cannot ${action}. Restore the course to make changes.`
    );
    err.statusCode = 403;
    throw err;
  }
}

async function assertCourseFilesMutable(course, user, { action = 'mutate' } = {}) {
  if (!course) {
    const err = new Error('Course context required for file operation');
    err.statusCode = 400;
    throw err;
  }
  assertCourseOperational(course, { action });
  const { term, year } = getSemesterFromCourse(course);
  const lifecycle = await gradeLifecycleService.getLifecycle(course._id, term, year);
  if (lifecycle && FINALIZED_STATUSES.has(lifecycle.status)) {
    const err = new Error(
      `Course files are locked (${lifecycle.status}). File ${action} is not allowed after grade finalization.`
    );
    err.statusCode = 403;
    throw err;
  }
  return lifecycle;
}

module.exports = {
  resolveCourseForAssignment,
  assertCourseFilesMutable,
  assertCourseOperational,
};
