#!/usr/bin/env node
/**
 * Add stable group ids to course groups and backfill Assignment.groupId from Assignment.group.
 * Dry-run by default. Use --apply to write.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('../../models/course.model');
const Assignment = require('../../models/Assignment');
const Module = require('../../models/module.model');
const GroupSet = require('../../models/GroupSet');
const assignmentGroupService = require('../../services/assignmentGroup.service');
const migrationMetadata = require('../../services/migrationMetadata.service');

const apply = process.argv.includes('--apply');
const rollbackSimulate = process.argv.includes('--rollback-simulate');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const startedAt = Date.now();

  let coursesUpdated = 0;
  let assignmentsUpdated = 0;
  const mismatchReport = {
    coursesNeedingGroupIds: [],
    assignmentsNeedingGroupIds: [],
    rollbackSimulation: rollbackSimulate ? [] : undefined,
  };
  const courses = await Course.find({});

  for (const course of courses) {
    const normalized = assignmentGroupService.normalizeGroups(course.groups || []);
    const changed = JSON.stringify(course.groups || []) !== JSON.stringify(normalized);
    if (changed) {
      coursesUpdated += 1;
      mismatchReport.coursesNeedingGroupIds.push(String(course._id));
      if (apply) {
        course.groups = normalized;
        await course.save();
      }
    }
    if (rollbackSimulate) {
      const rollbackWouldUnset = (course.groups || []).filter((group) => group.id).length;
      if (rollbackWouldUnset) {
        mismatchReport.rollbackSimulation.push({
          type: 'course_group_ids',
          courseId: String(course._id),
          count: rollbackWouldUnset,
        });
      }
    }
  }

  const assignments = await Assignment.find({ group: { $exists: true, $ne: null } });
  for (const assignment of assignments) {
    let course = null;
    if (assignment.module) {
      const mod = await Module.findById(assignment.module).select('course').populate('course');
      course = mod?.course || null;
    } else if (assignment.groupSet) {
      const groupSet = await GroupSet.findById(assignment.groupSet).select('course').populate('course');
      course = groupSet?.course || null;
    }
    const group = assignmentGroupService.resolveGroupByName(course, assignment.group);
    if (group && assignment.groupId !== String(group.id || group._id)) {
      assignmentsUpdated += 1;
      mismatchReport.assignmentsNeedingGroupIds.push(String(assignment._id));
      if (apply) {
        assignment.groupId = String(group.id || group._id);
        await assignment.save();
      }
    }
  }

  const summary = {
    apply,
    rollbackSimulate,
    rowCounts: { coursesUpdated, assignmentsUpdated },
    mismatchReport,
    durationMs: Date.now() - startedAt,
  };
  if (!rollbackSimulate) {
    await migrationMetadata.recordMigrationRun('migrate-assignment-group-ids', summary, {
      apply,
      rollbackAvailable: true,
    });
  }
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
