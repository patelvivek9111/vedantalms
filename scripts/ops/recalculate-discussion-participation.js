#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const DiscussionParticipation = require('../../models/discussionParticipation.model');
const discussionParticipation = require('../../services/discussionParticipation.service');

const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');

const { apply } = parseRepairArgv();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const threads = await Thread.find({ deletedAt: null }).select('_id').lean();
  const samples = [];
  for (const thread of threads) {
    if (apply) {
      await discussionParticipation.recalculateThreadParticipation(thread._id);
      const count = await DiscussionParticipation.countDocuments({ threadId: thread._id });
      samples.push({ threadId: String(thread._id), participationRows: count });
    } else {
      samples.push({ threadId: String(thread._id), dryRun: true });
    }
  }
  console.log(
    JSON.stringify(
      finishReport(
        { script: 'recalculate-discussion-participation', apply, checked: threads.length, samples: samples.slice(0, 20) },
        ['participation']
      ),
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
