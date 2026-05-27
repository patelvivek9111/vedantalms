#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const discussionReplyService = require('../../services/discussionReply.service');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  const limit = Math.max(1, parseInt(process.env.DISCUSSION_BENCH_LIMIT || '50', 10));
  await mongoose.connect(uri);

  const threads = await Thread.find({ deletedAt: null })
    .sort({ lastActivity: -1 })
    .limit(limit)
    .select('_id title counters studentGrades groupSet groupId')
    .lean();

  const samples = [];
  for (const thread of threads) {
    const startedAt = Date.now();
    const page = await discussionReplyService.listRootReplies(thread, { page: 1, limit: 50 });
    samples.push({
      threadId: String(thread._id),
      replyCount: thread.counters?.replyCount ?? page.pagination.total,
      gradeRows: thread.studentGrades?.length || 0,
      groupScoped: Boolean(thread.groupSet || thread.groupId),
      pageSize: page.replies.length,
      source: page.source,
      durationMs: Date.now() - startedAt,
    });
  }

  const maxReplyCount = samples.reduce((max, sample) => Math.max(max, sample.replyCount), 0);
  const maxDurationMs = samples.reduce((max, sample) => Math.max(max, sample.durationMs), 0);
  console.log(JSON.stringify({ sampled: samples.length, maxReplyCount, maxDurationMs, samples }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
