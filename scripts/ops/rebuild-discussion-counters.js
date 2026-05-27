#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const discussionCounterService = require('../../services/discussionCounter.service');

const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');

const { apply } = parseRepairArgv();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const cursor = Thread.find({ deletedAt: null }).select('_id counters').cursor();
  const results = [];
  for await (const thread of cursor) {
    if (apply) {
      const counters = await discussionCounterService.recomputeCounters(thread._id);
      results.push({ threadId: String(thread._id), counters });
    } else {
      results.push({ threadId: String(thread._id), dryRun: true });
    }
  }
  console.log(JSON.stringify(finishReport({ script: 'rebuild-discussion-counters', apply, checked: results.length, samples: results.slice(0, 20) }, ['counters']), null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
