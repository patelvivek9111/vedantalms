#!/usr/bin/env node
/**
 * Normalize moderation flags on collection replies (hidden vs moderation.hidden).
 * Dry-run lists affected ids; --apply writes consistent hidden/restored shape.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');
const DiscussionReply = require('../../models/discussionReply.model');
const discussionCounterService = require('../../services/discussionCounter.service');

const { apply, strict } = parseRepairArgv();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const inconsistent = await DiscussionReply.find({
    deletedAt: null,
    $or: [
      { moderationState: 'hidden', hiddenByModerator: { $ne: true } },
      { 'moderation.hidden': true, moderationState: { $ne: 'hidden' } },
    ],
  })
    .select('_id threadId moderationState moderation hiddenByModerator')
    .lean();

  const updates = [];
  for (const reply of inconsistent) {
    const shouldBeHidden =
      reply.moderationState === 'hidden' || reply.moderation?.hidden === true;
    if (shouldBeHidden) {
      updates.push({
        id: reply._id,
        threadId: reply.threadId,
        set: {
          moderationState: 'hidden',
          hiddenByModerator: true,
          'moderation.hidden': true,
        },
      });
    }
  }

  if (apply && updates.length) {
    for (const u of updates) {
      await DiscussionReply.updateOne(
        { _id: u.id },
        {
          $set: {
            ...u.set,
            'moderation.hiddenAt': new Date(),
            'moderation.lastAction': 'hidden',
            'moderation.lastActionAt': new Date(),
          },
        }
      );
      await discussionCounterService.recomputeCounters(u.threadId).catch(() => {});
    }
  }

  const report = finishReport(
    {
      script: 'repair-discussion-moderation-transitions',
      apply,
      affected: inconsistent.length,
      samples: updates.slice(0, 25).map((u) => ({ replyId: String(u.id), threadId: String(u.threadId) })),
    },
    ['moderation', 'counters']
  );

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (strict && inconsistent.length) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
