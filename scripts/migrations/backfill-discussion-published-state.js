#!/usr/bin/env node
/**
 * Backfill Thread.published for legacy rows missing the field (treated as published by access layer).
 * Dry-run by default. Use --apply to write.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');

const { apply } = parseRepairArgv();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const filter = {
    deletedAt: null,
    $or: [{ published: { $exists: false } }, { published: null }],
  };
  const count = await Thread.countDocuments(filter);
  let modified = 0;
  if (apply && count) {
    const res = await Thread.updateMany(filter, { $set: { published: true } });
    modified = res.modifiedCount ?? 0;
  }
  console.log(
    JSON.stringify(
      finishReport(
        {
          script: 'backfill-discussion-published-state',
          apply,
          matched: count,
          modified: apply ? modified : 0,
        },
        ['embeddedPrune', 'general']
      ),
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
