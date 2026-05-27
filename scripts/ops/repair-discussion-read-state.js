#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const DiscussionParticipation = require('../../models/discussionParticipation.model');

const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');

const { apply, strict } = parseRepairArgv();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const invalidRows = await DiscussionParticipation.find({
    $or: [
      { unreadCount: { $lt: 0 } },
      { replyCount: { $lt: 0 } },
      { rootReplyCount: { $lt: 0 } },
    ],
  }).lean();
  const orphanedRows = await DiscussionParticipation.aggregate([
    {
      $lookup: {
        from: 'threads',
        localField: 'threadId',
        foreignField: '_id',
        as: 'thread',
      },
    },
    { $match: { thread: { $size: 0 } } },
    { $project: { _id: 1, threadId: 1, userId: 1 } },
  ]);

  if (apply && invalidRows.length) {
    await DiscussionParticipation.updateMany(
      { unreadCount: { $lt: 0 } },
      { $set: { unreadCount: 0 } }
    );
    await DiscussionParticipation.updateMany(
      { replyCount: { $lt: 0 } },
      { $set: { replyCount: 0 } }
    );
    await DiscussionParticipation.updateMany(
      { rootReplyCount: { $lt: 0 } },
      { $set: { rootReplyCount: 0 } }
    );
  }
  if (apply && orphanedRows.length) {
    await DiscussionParticipation.deleteMany({ _id: { $in: orphanedRows.map((row) => row._id) } });
  }

  console.log(JSON.stringify(finishReport({
    script: 'repair-discussion-read-state',
    apply,
    invalidRows: invalidRows.length,
    orphanedRows: orphanedRows.length,
    samples: invalidRows.slice(0, 20).map((row) => ({
      threadId: String(row.threadId),
      userId: String(row.userId),
      unreadCount: row.unreadCount,
      replyCount: row.replyCount,
      rootReplyCount: row.rootReplyCount,
    })),
    orphanedSamples: orphanedRows.slice(0, 20).map((row) => ({
      threadId: String(row.threadId),
      userId: String(row.userId),
    })),
  }, ['readState', 'participation']), null, 2));
  await mongoose.disconnect();
  if (strict && (invalidRows.length || orphanedRows.length)) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
