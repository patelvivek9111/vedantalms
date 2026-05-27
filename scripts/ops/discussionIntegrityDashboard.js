#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const DiscussionReply = require('../../models/discussionReply.model');
const DiscussionParticipation = require('../../models/discussionParticipation.model');
const DiscussionAuditEvent = require('../../models/discussionAuditEvent.model');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
const applyExitCode = process.argv.includes('--strict');

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const [threads, hiddenReplies, moderationEvents] = await Promise.all([
    Thread.find({ deletedAt: null }).select('_id title counters replies updatedAt').lean(),
    DiscussionReply.countDocuments({ moderationState: 'hidden', deletedAt: null }),
    DiscussionAuditEvent.countDocuments({
      action: { $in: ['reply_hidden', 'reply_restored', 'discussion_locked', 'discussion_unlocked'] },
    }),
  ]);

  const issues = [];
  let totalCollectionReplies = 0;
  let oversizedThreads = 0;
  let unreadDriftRows = 0;
  let orphanedReplies = 0;
  let orphanedParticipationRows = 0;

  for (const thread of threads) {
    const [collectionReplyCount, participationCount, negativeUnreadCount, childrenWithMissingParents] = await Promise.all([
      DiscussionReply.countDocuments({ threadId: thread._id, deletedAt: null }),
      DiscussionParticipation.countDocuments({ threadId: thread._id }),
      DiscussionParticipation.countDocuments({ threadId: thread._id, unreadCount: { $lt: 0 } }),
      DiscussionReply.aggregate([
        { $match: { threadId: thread._id, parentReplyId: { $ne: null }, deletedAt: null } },
        {
          $lookup: {
            from: 'discussionreplies',
            localField: 'parentReplyId',
            foreignField: '_id',
            as: 'parent',
          },
        },
        { $match: { parent: { $size: 0 } } },
        { $count: 'count' },
      ]),
    ]);

    totalCollectionReplies += collectionReplyCount;
    unreadDriftRows += negativeUnreadCount;
    orphanedReplies += childrenWithMissingParents[0]?.count || 0;
    if ((thread.replies || []).length > 1000) oversizedThreads += 1;

    const counterReplyCount = thread.counters?.replyCount || 0;
    if (collectionReplyCount > 0 && counterReplyCount !== collectionReplyCount) {
      issues.push({
        type: 'counter_mismatch',
        threadId: String(thread._id),
        title: thread.title,
        counterReplyCount,
        collectionReplyCount,
      });
    }
    if (collectionReplyCount > 0 && participationCount === 0) {
      orphanedParticipationRows += 1;
      issues.push({
        type: 'missing_participation',
        threadId: String(thread._id),
        title: thread.title,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      threads: threads.length,
      collectionReplies: totalCollectionReplies,
      hiddenReplies,
      moderationEvents,
      oversizedThreads,
      unreadDriftRows,
      orphanedReplies,
      orphanedParticipationRows,
      issues: issues.length,
    },
    issues: issues.slice(0, 100),
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (applyExitCode && (issues.length || unreadDriftRows || orphanedReplies)) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
