#!/usr/bin/env node
/**
 * Backfill embedded Thread.replies into DiscussionReply.
 * Dry-run by default. Use --apply to write, and --prune-embedded to clear legacy arrays after backfill.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const DiscussionReply = require('../../models/discussionReply.model');
const discussionCounterService = require('../../services/discussionCounter.service');

const apply = process.argv.includes('--apply');
const pruneEmbedded = process.argv.includes('--prune-embedded');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function buildDepthMap(replies) {
  const byId = new Map(replies.map((reply) => [String(reply._id), reply]));
  const memo = new Map();

  function depthFor(reply) {
    const id = String(reply._id);
    if (memo.has(id)) return memo.get(id);
    const parentId = normalizeId(reply.parentReply);
    if (!parentId || !byId.has(parentId)) {
      memo.set(id, { depth: 0, path: '' });
      return memo.get(id);
    }
    const parent = byId.get(parentId);
    const parentDepth = depthFor(parent);
    const result = {
      depth: parentDepth.depth + 1,
      path: parentDepth.path ? `${parentDepth.path}/${parentId}` : parentId,
    };
    memo.set(id, result);
    return result;
  }

  for (const reply of replies) depthFor(reply);
  return memo;
}

async function migrateThread(thread) {
  const replies = thread.replies || [];
  if (!replies.length) {
    return { threadId: String(thread._id), embeddedReplies: 0, inserted: 0, skipped: 0, pruned: false };
  }

  const depthMap = buildDepthMap(replies);
  let inserted = 0;
  let skipped = 0;
  const operations = [];

  for (const reply of replies) {
    const existing = await DiscussionReply.exists({ threadId: thread._id, legacyReplyId: reply._id });
    if (existing) {
      skipped += 1;
      continue;
    }
    inserted += 1;
    const depth = depthMap.get(String(reply._id)) || { depth: 0, path: '' };
    const fileAssets = reply.fileAssets || [];
    operations.push({
      insertOne: {
        document: {
          threadId: thread._id,
          parentReplyId: reply.parentReply || null,
          authorId: reply.author,
          content: reply.content || '',
          sanitizedContent: reply.content || '',
          depth: depth.depth,
          path: depth.path,
          fileAssets,
          attachments: fileAssets,
          likes: reply.likes || [],
          likeCount: Array.isArray(reply.likes) ? reply.likes.length : 0,
          deletedAt: reply.deletedAt || null,
          deletedBy: reply.deletedBy || null,
          editHistory: (reply.editHistory || []).map((entry) => ({
            editedAt: entry.editedAt,
            editedBy: entry.editedBy,
            previousContent: entry.previousContent,
            previousSanitizedContent: entry.previousContent,
            reason: entry.reason || null,
          })),
          legacyReplyId: reply._id,
          createdAt: reply.createdAt || thread.createdAt,
          updatedAt: reply.updatedAt || thread.updatedAt,
        },
      },
    });
  }

  if (apply && operations.length) {
    await DiscussionReply.bulkWrite(operations, { ordered: false });
  }

  let pruned = false;
  if (apply) {
    await discussionCounterService.recomputeCounters(thread._id);
    if (pruneEmbedded) {
      thread.replies = [];
      await thread.save();
      pruned = true;
    }
  }

  return {
    threadId: String(thread._id),
    embeddedReplies: replies.length,
    inserted,
    skipped,
    pruned,
  };
}

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const startedAt = Date.now();
  const cursor = Thread.find({ 'replies.0': { $exists: true } }).cursor();
  const results = [];

  for await (const thread of cursor) {
    results.push(await migrateThread(thread));
  }

  const totals = results.reduce(
    (acc, row) => {
      acc.threads += 1;
      acc.embeddedReplies += row.embeddedReplies;
      acc.inserted += row.inserted;
      acc.skipped += row.skipped;
      acc.pruned += row.pruned ? 1 : 0;
      return acc;
    },
    { threads: 0, embeddedReplies: 0, inserted: 0, skipped: 0, pruned: 0 }
  );

  console.log(
    JSON.stringify(
      {
        apply,
        pruneEmbedded,
        durationMs: Date.now() - startedAt,
        totals,
        samples: results.slice(0, 20),
      },
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
