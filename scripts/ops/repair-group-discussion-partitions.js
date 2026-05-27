#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const Group = require('../../models/Group');

const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');

const { apply, strict } = parseRepairArgv();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const threads = await Thread.find({
    deletedAt: null,
    groupSet: { $exists: true, $ne: null },
    $or: [{ groupId: { $exists: false } }, { groupId: null }],
  }).select('_id title course groupSet groupId').lean();

  const repaired = [];
  const manual = [];

  for (const thread of threads) {
    const groups = await Group.find({ groupSet: thread.groupSet }).select('_id name members').lean();
    if (groups.length === 1) {
      repaired.push({
        threadId: String(thread._id),
        title: thread.title,
        groupId: String(groups[0]._id),
        groupName: groups[0].name,
      });
      if (apply) {
        await Thread.updateOne({ _id: thread._id }, { $set: { groupId: groups[0]._id } });
      }
    } else {
      manual.push({
        threadId: String(thread._id),
        title: thread.title,
        groupSet: String(thread.groupSet),
        candidateGroups: groups.map((group) => ({
          groupId: String(group._id),
          name: group.name,
          memberCount: (group.members || []).length,
        })),
      });
    }
  }

  console.log(JSON.stringify(
    finishReport(
      {
        script: 'repair-group-discussion-partitions',
        apply,
        checked: threads.length,
        autoRepairable: repaired.length,
        manualRequired: manual.length,
        repaired,
        manual,
      },
      ['groupPartitions']
    ),
    null,
    2
  ));
  await mongoose.disconnect();
  if (strict && manual.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
