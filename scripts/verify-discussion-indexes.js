#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../models/thread.model');
const DiscussionReply = require('../models/discussionReply.model');
const DiscussionParticipation = require('../models/discussionParticipation.model');
const DiscussionAuditEvent = require('../models/discussionAuditEvent.model');
require('../models/user.model');
require('../models/fileAsset.model');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
const strict = process.argv.includes('--strict');

function keyString(key) {
  return Object.entries(key).map(([field, direction]) => `${field}:${direction}`).join(',');
}

function hasIndex(indexes, expectedKey) {
  const expected = keyString(expectedKey);
  return indexes.some((index) => keyString(index.key) === expected);
}

function collectStages(plan, stages = []) {
  if (!plan || typeof plan !== 'object') return stages;
  if (plan.stage) stages.push(plan.stage);
  for (const value of Object.values(plan)) {
    if (Array.isArray(value)) value.forEach((entry) => collectStages(entry, stages));
    else if (value && typeof value === 'object') collectStages(value, stages);
  }
  return stages;
}

function winningPlan(explain) {
  return explain?.queryPlanner?.winningPlan || explain?.stages?.[0]?.$cursor?.queryPlanner?.winningPlan || {};
}

async function explainQuery(label, queryPromise) {
  const explain = await queryPromise.explain('executionStats');
  const stages = collectStages(winningPlan(explain));
  const executionStats = explain.executionStats || explain?.stages?.[0]?.$cursor?.executionStats || {};
  return {
    label,
    stages,
    totalDocsExamined: executionStats.totalDocsExamined || 0,
    totalKeysExamined: executionStats.totalKeysExamined || 0,
    executionTimeMillis: executionStats.executionTimeMillis || 0,
    collectionScan: stages.includes('COLLSCAN'),
    blockingSort: stages.includes('SORT'),
  };
}

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const warnings = [];
  const blockingIssues = [];
  const [replyIndexes, participationIndexes, auditIndexes, threadIndexes] = await Promise.all([
    DiscussionReply.collection.indexes(),
    DiscussionParticipation.collection.indexes(),
    DiscussionAuditEvent.collection.indexes(),
    Thread.collection.indexes(),
  ]);

  const required = [
    { collection: 'discussionreplies', indexes: replyIndexes, key: { threadId: 1, parentReplyId: 1, createdAt: 1, _id: 1 }, purpose: 'root and child cursor pagination' },
    { collection: 'discussionreplies', indexes: replyIndexes, key: { authorId: 1, createdAt: -1 }, purpose: 'author activity lookup' },
    { collection: 'discussionreplies', indexes: replyIndexes, key: { threadId: 1, createdAt: -1 }, purpose: 'recent reply batches' },
    { collection: 'discussionreplies', indexes: replyIndexes, key: { threadId: 1, deletedAt: 1 }, purpose: 'active reply counts' },
    { collection: 'discussionreplies', indexes: replyIndexes, key: { parentReplyId: 1, createdAt: 1 }, purpose: 'child expansion' },
    { collection: 'discussionparticipations', indexes: participationIndexes, key: { threadId: 1, userId: 1 }, purpose: 'read state and unique participation row' },
    { collection: 'discussionparticipations', indexes: participationIndexes, key: { userId: 1, updatedAt: -1 }, purpose: 'student discussion activity' },
    { collection: 'discussionparticipations', indexes: participationIndexes, key: { threadId: 1, unreadCount: 1 }, purpose: 'unread drift detection' },
    { collection: 'discussionauditevents', indexes: auditIndexes, key: { thread: 1, createdAt: -1 }, purpose: 'thread moderation log' },
    { collection: 'discussionauditevents', indexes: auditIndexes, key: { action: 1, createdAt: -1 }, purpose: 'moderation event counts' },
    { collection: 'threads', indexes: threadIndexes, key: { groupSet: 1, groupId: 1, published: 1, lastActivity: -1 }, purpose: 'group-scoped discussion lists' },
    { collection: 'threads', indexes: threadIndexes, key: { course: 1, deletedAt: 1, lastActivity: -1 }, purpose: 'course discussion lists' },
    { collection: 'threads', indexes: threadIndexes, key: { module: 1, published: 1, lastActivity: -1 }, purpose: 'module discussion rows' },
  ];

  for (const item of required) {
    if (!hasIndex(item.indexes, item.key)) {
      blockingIssues.push({
        type: 'missing_index',
        collection: item.collection,
        key: item.key,
        purpose: item.purpose,
        remediation: `Create index ${JSON.stringify(item.key)} on ${item.collection}`,
      });
    }
  }

  const sampleThread = await Thread.findOne({ deletedAt: null }).select('_id course module groupSet groupId').lean();
  if (sampleThread) {
    const explains = [];
    explains.push(await explainQuery('thread_course_list', Thread.find({ course: sampleThread.course, deletedAt: null }).sort({ lastActivity: -1 }).limit(20)));
    if (sampleThread.module) {
      explains.push(await explainQuery('thread_module_list', Thread.find({ module: sampleThread.module, deletedAt: null }).sort({ lastActivity: -1 }).limit(20)));
    }
    if (sampleThread.groupSet) {
      explains.push(await explainQuery('thread_group_list', Thread.find({ groupSet: sampleThread.groupSet, groupId: sampleThread.groupId || null, deletedAt: null }).sort({ lastActivity: -1 }).limit(20)));
    }
    explains.push(await explainQuery('reply_root_page', DiscussionReply.find({ threadId: sampleThread._id, parentReplyId: null }).sort({ createdAt: 1, _id: 1 }).limit(51)));
    explains.push(await explainQuery('reply_recent_batch', DiscussionReply.find({ threadId: sampleThread._id }).sort({ createdAt: -1 }).limit(100)));
    explains.push(await explainQuery('read_state_lookup', DiscussionParticipation.find({ threadId: sampleThread._id }).sort({ updatedAt: -1 }).limit(50)));
    explains.push(await explainQuery('moderation_log', DiscussionAuditEvent.find({ thread: sampleThread._id }).sort({ createdAt: -1 }).limit(50)));

    for (const explain of explains) {
      if (explain.collectionScan) {
        blockingIssues.push({
          type: 'collection_scan',
          query: explain.label,
          remediation: 'Add or fix the matching compound index, then rerun explain.',
          explain,
        });
      }
      if (explain.blockingSort) {
        warnings.push({
          type: 'blocking_sort',
          query: explain.label,
          remediation: 'Align sort order with a compound index.',
          explain,
        });
      }
      if (explain.totalDocsExamined > Math.max(1000, explain.totalKeysExamined * 10)) {
        warnings.push({
          type: 'high_docs_examined',
          query: explain.label,
          remediation: 'Tighten filters or add a more selective compound index.',
          explain,
        });
      }
    }
  } else {
    warnings.push({ type: 'no_sample_thread', remediation: 'Seed discussions before query-plan certification.' });
  }

  const paginationAntiPatterns = [
    {
      type: 'page_skip_supported_for_compatibility',
      severity: 'warning',
      remediation: 'Prefer cursor pagination for large offsets; page/pageSize remains only a compatibility fallback.',
    },
  ];
  warnings.push(...paginationAntiPatterns);

  const report = {
    generatedAt: new Date().toISOString(),
    pass: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    indexCounts: {
      DiscussionReply: replyIndexes.length,
      DiscussionParticipation: participationIndexes.length,
      DiscussionAuditEvent: auditIndexes.length,
      Thread: threadIndexes.length,
    },
  };
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (strict && !report.pass) process.exit(1);
  if (!report.pass) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
