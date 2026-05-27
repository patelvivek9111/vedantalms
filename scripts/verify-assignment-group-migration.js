#!/usr/bin/env node
/**
 * Verify assignment groupId dual-write safety after migration.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');
const GroupSet = require('../models/GroupSet');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

function groupKey(group) {
  return String(group.id || group._id || '');
}

async function courseForAssignment(assignment) {
  if (assignment.module) {
    const mod = await Module.findById(assignment.module).select('course').lean();
    return mod?.course ? Course.findById(mod.course).lean() : null;
  }
  if (assignment.groupSet) {
    const groupSet = await GroupSet.findById(assignment.groupSet).select('course').lean();
    return groupSet?.course ? Course.findById(groupSet.course).lean() : null;
  }
  return null;
}

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });

  const problems = [];
  const courses = await Course.find({}).select('_id title groups').lean();
  for (const course of courses) {
    const ids = new Set();
    for (const group of course.groups || []) {
      const id = groupKey(group);
      if (!id) problems.push({ type: 'course_group_missing_id', courseId: String(course._id), group: group.name });
      if (ids.has(id)) problems.push({ type: 'course_group_duplicate_id', courseId: String(course._id), groupId: id });
      ids.add(id);
    }
  }

  const assignments = await Assignment.find({}).select('_id title module groupSet group groupId').lean();
  for (const assignment of assignments) {
    if (!assignment.group && !assignment.groupId) continue;
    const course = await courseForAssignment(assignment);
    if (!course) {
      problems.push({ type: 'assignment_course_unresolved', assignmentId: String(assignment._id) });
      continue;
    }
    const groups = course.groups || [];
    const byId = assignment.groupId
      ? groups.find((group) => groupKey(group) === String(assignment.groupId))
      : null;
    const byName = assignment.group
      ? groups.find((group) => group.name === assignment.group)
      : null;
    if (assignment.groupId && !byId) {
      problems.push({
        type: 'assignment_groupId_orphaned',
        assignmentId: String(assignment._id),
        courseId: String(course._id),
        groupId: assignment.groupId,
      });
    }
    if (!assignment.groupId && assignment.group && byName) {
      problems.push({
        type: 'assignment_missing_groupId',
        assignmentId: String(assignment._id),
        courseId: String(course._id),
        group: assignment.group,
      });
    }
    if (assignment.groupId && byId && assignment.group && byId.name !== assignment.group) {
      problems.push({
        type: 'assignment_group_name_drift',
        assignmentId: String(assignment._id),
        courseId: String(course._id),
        groupId: assignment.groupId,
        assignmentGroup: assignment.group,
        resolvedGroup: byId.name,
      });
    }
  }

  console.log(JSON.stringify({ ok: problems.length === 0, problemCount: problems.length, problems }, null, 2));
  if (problems.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
