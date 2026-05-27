#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../models/thread.model');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const issues = [];
  const threads = await Thread.find({
    deletedAt: null,
    $or: [{ groupSet: { $exists: true, $ne: null } }, { groupId: { $exists: true, $ne: null } }],
  }).select('_id course groupSet groupId').lean();

  for (const thread of threads) {
    if (!thread.groupSet || !thread.groupId) {
      issues.push({ threadId: String(thread._id), issue: 'group_discussion_missing_partition' });
      continue;
    }
    const [groupSet, group] = await Promise.all([
      GroupSet.findById(thread.groupSet).select('_id course').lean(),
      Group.findById(thread.groupId).select('_id groupSet course').lean(),
    ]);
    if (!groupSet) issues.push({ threadId: String(thread._id), issue: 'missing_group_set' });
    if (!group) issues.push({ threadId: String(thread._id), issue: 'missing_group' });
    if (group && String(group.groupSet) !== String(thread.groupSet)) {
      issues.push({ threadId: String(thread._id), issue: 'group_set_mismatch' });
    }
    if (groupSet?.course && String(groupSet.course) !== String(thread.course)) {
      issues.push({ threadId: String(thread._id), issue: 'group_set_course_mismatch' });
    }
    if (group?.course && String(group.course) !== String(thread.course)) {
      issues.push({ threadId: String(thread._id), issue: 'group_course_mismatch' });
    }
  }

  console.log(JSON.stringify({ checked: threads.length, issues }, null, 2));
  await mongoose.disconnect();
  process.exit(issues.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
