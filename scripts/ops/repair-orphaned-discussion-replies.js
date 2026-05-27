#!/usr/bin/env node
/**
 * Soft-delete DiscussionReply rows whose thread is missing or soft-deleted.
 * Default: dry-run. --apply performs updates. --strict exits 1 if orphans found (dry-run or apply).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');
const Thread = require('../../models/thread.model');
const DiscussionReply = require('../../models/discussionReply.model');
const discussionCounterService = require('../../services/discussionCounter.service');

const { apply, strict } = parseRepairArgv();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const candidates = await DiscussionReply.aggregate([
    {
      $lookup: {
        from: Thread.collection.collectionName,
        localField: 'threadId',
        foreignField: '_id',
        as: 't',
      },
    },
    {
      $match: {
        deletedAt: null,
        $or: [{ t: { $size: 0 } }, { 't.0.deletedAt': { $ne: null } }],
      },
    },
    { $project: { _id: 1, threadId: 1 } },
    { $limit: 5000 },
  ]);

  const repaired = [];
  if (apply && candidates.length) {
    const now = new Date();
    for (const row of candidates) {
      await DiscussionReply.updateOne(
        { _id: row._id },
        {
          $set: {
            deletedAt: now,
            deletedReason: 'orphan_repair',
            content: '',
            sanitizedContent: '',
          },
        }
      );
      repaired.push(String(row._id));
    }
    const threadIds = [...new Set(candidates.map((c) => String(c.threadId)))];
    for (const tid of threadIds) {
      if (mongoose.Types.ObjectId.isValid(tid)) {
        await discussionCounterService.recomputeCounters(tid).catch(() => {});
      }
    }
  }

  const report = finishReport(
    {
      script: 'repair-orphaned-discussion-replies',
      apply,
      orphanCandidates: candidates.length,
      samples: candidates.slice(0, 25).map((c) => ({ replyId: String(c._id), threadId: String(c.threadId) })),
      repairedIds: apply ? repaired.slice(0, 50) : [],
    },
    ['orphanedReplies', 'counters']
  );

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (strict && candidates.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
