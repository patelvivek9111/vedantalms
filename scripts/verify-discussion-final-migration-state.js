#!/usr/bin/env node
/**
 * Phase G — final migration integrity: embedded vs collection, participation,
 * counters, audit linkage, duplicates, group mappings.
 * Dry-run only. Use --strict to exit non-zero when issues exist.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../models/thread.model');
const DiscussionReply = require('../models/discussionReply.model');
const DiscussionParticipation = require('../models/discussionParticipation.model');
const DiscussionAuditEvent = require('../models/discussionAuditEvent.model');
const Course = require('../models/course.model');
const Group = require('../models/Group');

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

  const threads = await Thread.find({ deletedAt: null }).select('_id title course replies counters groupSet groupId').lean();

  for (const thread of threads) {
    const legacyReplies = Array.isArray(thread.replies) ? thread.replies : [];
    const collectionReplies = await DiscussionReply.find({ threadId: thread._id })
      .select(
        '_id legacyReplyId parentReplyId authorId depth moderationState deletedAt hiddenByModerator moderation'
      )
      .lean();
    const activeCollectionCount = collectionReplies.filter((reply) => !reply.deletedAt).length;

    if (legacyReplies.length && collectionReplies.length) {
      const legacyIds = new Set(legacyReplies.map((reply) => normalizeId(reply._id)));
      const migratedLegacyIds = new Set(
        collectionReplies.map((reply) => normalizeId(reply.legacyReplyId)).filter(Boolean)
      );
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

    if (legacyReplies.length && !collectionReplies.length) {
      issues.push({ threadId: String(thread._id), issue: 'embedded_replies_without_collection_backing' });
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
      const hiddenLegacy = reply.moderationState === 'hidden' && reply.hiddenByModerator !== true;
      const hiddenMod = reply.moderation?.hidden === true && reply.moderationState !== 'hidden';
      if (hiddenLegacy || hiddenMod) {
        issues.push({ threadId: String(thread._id), replyId: String(reply._id), issue: 'moderation_transition_inconsistent' });
      }
    }

    const participationRows = await DiscussionParticipation.countDocuments({ threadId: thread._id });
    const participantIds = new Set(
      collectionReplies.filter((reply) => !reply.deletedAt).map((reply) => normalizeId(reply.authorId))
    );
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

    const course = thread.course ? await Course.findById(thread.course).select('_id').lean() : null;
    if (thread.course && !course) {
      issues.push({ threadId: String(thread._id), issue: 'missing_course' });
    }

    if (thread.groupId) {
      const group = await Group.findById(thread.groupId).select('_id groupSet').lean();
      if (!group) {
        issues.push({ threadId: String(thread._id), issue: 'invalid_group_mapping_missing_group' });
      } else if (thread.groupSet && String(group.groupSet) !== String(thread.groupSet)) {
        issues.push({ threadId: String(thread._id), issue: 'invalid_group_mapping_group_set_mismatch' });
      }
    }
  }

  const orphanedParticipation = await DiscussionParticipation.aggregate([
    {
      $lookup: {
        from: Thread.collection.collectionName,
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

  const duplicateParticipation = await DiscussionParticipation.aggregate([
    {
      $group: {
        _id: { threadId: '$threadId', userId: '$userId' },
        n: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    { $match: { n: { $gt: 1 } } },
    { $limit: 50 },
  ]);
  if (duplicateParticipation.length) {
    issues.push({
      issue: 'duplicate_participation_keys',
      groups: duplicateParticipation.length,
      sample: duplicateParticipation.slice(0, 5),
    });
  }

  const orphanedAuditThreads = await DiscussionAuditEvent.aggregate([
    {
      $lookup: {
        from: Thread.collection.collectionName,
        localField: 'thread',
        foreignField: '_id',
        as: 't',
      },
    },
    { $match: { t: { $size: 0 } } },
    { $count: 'count' },
  ]);
  if (orphanedAuditThreads[0]?.count) {
    issues.push({ issue: 'orphaned_moderation_events_bad_thread', count: orphanedAuditThreads[0].count });
  }

  const orphanedAuditReplies = await DiscussionAuditEvent.aggregate([
    { $match: { replyId: { $ne: null } } },
    {
      $lookup: {
        from: DiscussionReply.collection.collectionName,
        localField: 'replyId',
        foreignField: '_id',
        as: 'r',
      },
    },
    { $match: { r: { $size: 0 } } },
    { $count: 'count' },
  ]);
  if (orphanedAuditReplies[0]?.count) {
    issues.push({ issue: 'orphaned_moderation_events_bad_reply', count: orphanedAuditReplies[0].count });
  }

  const orphanedReplies = await DiscussionReply.aggregate([
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
    { $count: 'count' },
  ]);
  if (orphanedReplies[0]?.count) {
    issues.push({ issue: 'orphaned_active_replies', count: orphanedReplies[0].count });
  }

  const mixedAgg = await Thread.aggregate([
    { $match: { deletedAt: null, 'replies.0': { $exists: true } } },
    {
      $lookup: {
        from: DiscussionReply.collection.collectionName,
        localField: '_id',
        foreignField: 'threadId',
        as: 'dr',
        pipeline: [{ $limit: 1 }],
      },
    },
    { $match: { 'dr.0': { $exists: true } } },
    { $count: 'count' },
  ]);
  const mixedReplyState = mixedAgg[0]?.count || 0;
  if (mixedReplyState > 0) {
    issues.push({
      issue: 'mixed_embedded_and_collection_replies',
      threadCount: mixedReplyState,
      note: 'Run migration closure repair or prune embedded after parity',
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    checkedThreads: threads.length,
    maxDepth,
    issues,
    safeToPruneEmbeddedReplies: issues.length === 0,
    status: issues.length === 0 ? 'PASS' : 'FAIL',
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (strict && issues.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
