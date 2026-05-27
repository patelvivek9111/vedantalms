#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../models/thread.model');
const DiscussionReply = require('../models/discussionReply.model');
const DiscussionParticipation = require('../models/discussionParticipation.model');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
const strict = process.argv.includes('--strict');
const maxDepth = Math.max(1, parseInt(process.env.DISCUSSION_MAX_REPLY_DEPTH || '10', 10));

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const issues = [];
  const threads = await Thread.find({ deletedAt: null })
    .select('_id title replies counters')
    .lean();

  for (const thread of threads) {
    const legacyReplies = Array.isArray(thread.replies) ? thread.replies : [];
    const collectionReplies = await DiscussionReply.find({ threadId: thread._id }).select(
      '_id legacyReplyId parentReplyId authorId depth moderationState deletedAt hiddenByModerator'
    ).lean();
    const activeCollectionCount = collectionReplies.filter((reply) => !reply.deletedAt).length;

    if (legacyReplies.length && collectionReplies.length) {
      const legacyIds = new Set(legacyReplies.map((reply) => normalizeId(reply._id)));
      const migratedLegacyIds = new Set(collectionReplies.map((reply) => normalizeId(reply.legacyReplyId)).filter(Boolean));
      for (const legacyId of legacyIds) {
        if (!migratedLegacyIds.has(legacyId)) {
          issues.push({ threadId: String(thread._id), issue: 'legacy_reply_missing_collection_copy', legacyId });
        }
      }
      if (legacyReplies.filter((reply) => !reply.deletedAt).length !== activeCollectionCount) {
        issues.push({
          threadId: String(thread._id),
          issue: 'legacy_collection_active_count_mismatch',
          legacyActive: legacyReplies.filter((reply) => !reply.deletedAt).length,
          collectionActive: activeCollectionCount,
        });
      }
    }

    if (collectionReplies.some((reply) => reply.depth > maxDepth)) {
      issues.push({ threadId: String(thread._id), issue: 'reply_depth_violation' });
    }

    const collectionIds = new Set(collectionReplies.map((reply) => normalizeId(reply._id)));
    for (const reply of collectionReplies) {
      const parentId = normalizeId(reply.parentReplyId);
      if (parentId && !collectionIds.has(parentId)) {
        issues.push({
          threadId: String(thread._id),
          replyId: String(reply._id),
          issue: 'invalid_parent_reply_chain',
          parentReplyId: parentId,
        });
      }
      if (reply.moderationState === 'hidden' && reply.hiddenByModerator !== true) {
        issues.push({ threadId: String(thread._id), replyId: String(reply._id), issue: 'hidden_reply_state_incomplete' });
      }
    }

    const participationRows = await DiscussionParticipation.countDocuments({ threadId: thread._id });
    const participantIds = new Set(collectionReplies.filter((reply) => !reply.deletedAt).map((reply) => normalizeId(reply.authorId)));
    if (activeCollectionCount > 0 && participationRows < participantIds.size) {
      issues.push({
        threadId: String(thread._id),
        issue: 'participation_rows_below_participant_count',
        participationRows,
        participantCount: participantIds.size,
      });
    }

    if (collectionReplies.length && (thread.counters?.replyCount || 0) !== activeCollectionCount) {
      issues.push({
        threadId: String(thread._id),
        issue: 'counter_reply_count_mismatch',
        counterReplyCount: thread.counters?.replyCount || 0,
        activeCollectionCount,
      });
    }
  }

  const orphanedParticipation = await DiscussionParticipation.aggregate([
    {
      $lookup: {
        from: 'threads',
        localField: 'threadId',
        foreignField: '_id',
        as: 'thread',
      },
    },
    { $match: { thread: { $size: 0 } } },
    { $count: 'count' },
  ]);
  if (orphanedParticipation[0]?.count) {
    issues.push({ issue: 'orphaned_participation_rows', count: orphanedParticipation[0].count });
  }

  console.log(JSON.stringify({
    checked: threads.length,
    maxDepth,
    issues,
    safeToPruneEmbeddedReplies: issues.length === 0,
  }, null, 2));
  await mongoose.disconnect();
  if (strict && issues.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
