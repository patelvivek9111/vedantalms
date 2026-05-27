#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const DiscussionReply = require('../../models/discussionReply.model');
const DiscussionParticipation = require('../../models/discussionParticipation.model');
require('../../models/user.model');
require('../../models/fileAsset.model');
const discussionReplyService = require('../../services/discussionReply.service');
const discussionCounterService = require('../../services/discussionCounter.service');
const discussionParticipation = require('../../services/discussionParticipation.service');

const apply = process.argv.includes('--apply');
const keep = process.argv.includes('--keep');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

const DEFAULT_SCENARIOS = [
  { name: '1k_students_50k_replies', studentCount: 1000, replyCount: 50000, concurrency: 25, depth: 3 },
  { name: '5k_students_50k_replies', studentCount: 5000, replyCount: 50000, concurrency: 50, depth: 3 },
];

const configuredScenario = process.env.DISCUSSION_BENCH_SCENARIO
  ? [JSON.parse(process.env.DISCUSSION_BENCH_SCENARIO)]
  : DEFAULT_SCENARIOS;

const pageLimit = Math.max(1, parseInt(process.env.DISCUSSION_BENCH_PAGE_LIMIT || '50', 10));
const sampleRuns = Math.max(1, parseInt(process.env.DISCUSSION_BENCH_SAMPLE_RUNS || '15', 10));
const thresholds = {
  rootPageP95Ms: Math.max(1, parseInt(process.env.DISCUSSION_BENCH_ROOT_P95_MS || '300', 10)),
  childPageP95Ms: Math.max(1, parseInt(process.env.DISCUSSION_BENCH_CHILD_P95_MS || '300', 10)),
  concurrentPaginationP95Ms: Math.max(1, parseInt(process.env.DISCUSSION_BENCH_CONCURRENT_PAGINATION_P95_MS || '2000', 10)),
  concurrentReplyP95Ms: Math.max(1, parseInt(process.env.DISCUSSION_BENCH_CONCURRENT_REPLY_P95_MS || '8500', 10)),
  concurrentMarkReadP95Ms: Math.max(1, parseInt(process.env.DISCUSSION_BENCH_MARK_READ_P95_MS || '2500', 10)),
  concurrentModerationP95Ms: Math.max(1, parseInt(process.env.DISCUSSION_BENCH_MODERATION_P95_MS || '4500', 10)),
  rootPayloadBytes: Math.max(1024, parseInt(process.env.DISCUSSION_BENCH_ROOT_PAYLOAD_BYTES || '262144', 10)),
  heapDeltaBytes: Math.max(1024, parseInt(process.env.DISCUSSION_BENCH_HEAP_DELTA_BYTES || '805306368', 10)),
  cpuUserMicros: Math.max(1000, parseInt(process.env.DISCUSSION_BENCH_CPU_USER_MICROS || '120000000', 10)),
};

function elapsed(startedAt) {
  return Date.now() - startedAt;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarize(values) {
  return {
    min: Math.min(...values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: Math.max(...values),
  };
}

function payloadBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

async function cleanupStaleSyntheticDiscussions() {
  const staleThreads = await Thread.find({ title: /^Synthetic institutional discussion / }).select('_id').lean();
  if (!staleThreads.length) return 0;
  const ids = staleThreads.map((thread) => thread._id);
  await Promise.all([
    DiscussionReply.deleteMany({ threadId: { $in: ids } }),
    DiscussionParticipation.deleteMany({ threadId: { $in: ids } }),
    Thread.deleteMany({ _id: { $in: ids } }),
  ]);
  return ids.length;
}

async function seedSyntheticDiscussion(scenario) {
  const courseId = new mongoose.Types.ObjectId();
  const authorId = new mongoose.Types.ObjectId();
  const thread = await Thread.create({
    title: `Synthetic institutional discussion ${scenario.name} ${new Date().toISOString()}`,
    content: 'Synthetic discussion used by discussionLargeCourseBench.',
    course: courseId,
    author: authorId,
    published: true,
    settings: { requirePostBeforeSee: false, allowLikes: true, allowComments: true },
  });

  const studentIds = Array.from({ length: scenario.studentCount }, () => new mongoose.Types.ObjectId());
  const rootIds = [];
  const replyIds = [];
  let operations = [];
  const rootEvery = Math.max(2, Math.floor(scenario.replyCount / Math.max(1, scenario.replyCount / 5)));

  for (let i = 0; i < scenario.replyCount; i += 1) {
    const id = new mongoose.Types.ObjectId();
    const isRoot = i % rootEvery === 0 || rootIds.length === 0;
    let parentReplyId = null;
    let depth = 0;
    let path = '';

    if (isRoot) {
      rootIds.push(id);
    } else {
      const parentIndex = Math.max(0, i - (i % Math.max(2, scenario.depth + 1)) - 1);
      parentReplyId = replyIds[parentIndex] || rootIds[i % rootIds.length];
      depth = Math.min(scenario.depth, (i % Math.max(1, scenario.depth)) + 1);
      path = String(parentReplyId);
    }
    replyIds.push(id);
    operations.push({
      insertOne: {
        document: {
          _id: id,
          threadId: thread._id,
          parentReplyId,
          authorId: studentIds[i % studentIds.length],
          content: `Synthetic reply ${i}`,
          sanitizedContent: `Synthetic reply ${i}`,
          depth,
          path,
          likeCount: i % 7,
          likes: [],
          childCount: 0,
          createdAt: new Date(Date.now() + i),
          updatedAt: new Date(Date.now() + i),
        },
      },
    });
    if (operations.length === 1000) {
      await DiscussionReply.bulkWrite(operations, { ordered: false });
      operations = [];
    }
  }

  if (operations.length) await DiscussionReply.bulkWrite(operations, { ordered: false });
  await discussionCounterService.recomputeCounters(thread._id);
  return { thread, studentIds, rootIds, replyIds };
}

async function timed(fn) {
  const startedAt = Date.now();
  const result = await fn();
  return { durationMs: elapsed(startedAt), result };
}

async function concurrentSamples(count, fn) {
  const startedAt = Date.now();
  const results = await Promise.all(Array.from({ length: count }, (_, index) => timed(() => fn(index))));
  return {
    wallMs: elapsed(startedAt),
    samples: results.map((row) => row.durationMs),
    results: results.map((row) => row.result),
  };
}

async function runScenario(scenario) {
  const heapBefore = process.memoryUsage().heapUsed;
  const cpuBefore = process.cpuUsage();
  const startedAt = Date.now();
  const { thread, studentIds, rootIds, replyIds } = await seedSyntheticDiscussion(scenario);
  const samples = {
    rootPageMs: [],
    childPageMs: [],
    concurrentPaginationMs: [],
    concurrentReplyMs: [],
    concurrentMarkReadMs: [],
    concurrentModerationMs: [],
  };
  let rootPage = null;
  let childPage = null;

  for (let run = 0; run < sampleRuns; run += 1) {
    let measurement = await timed(() => discussionReplyService.listRootReplies(thread, { limit: pageLimit }));
    rootPage = measurement.result;
    samples.rootPageMs.push(measurement.durationMs);

    measurement = await timed(() => discussionReplyService.listChildReplies(rootIds[0], { limit: pageLimit }));
    childPage = measurement.result;
    samples.childPageMs.push(measurement.durationMs);
  }

  const pagination = await concurrentSamples(scenario.concurrency, (index) =>
    discussionReplyService.listRootReplies(thread, { limit: pageLimit, page: (index % 3) + 1 })
  );
  samples.concurrentPaginationMs.push(...pagination.samples);

  const replyPost = await concurrentSamples(scenario.concurrency, (index) =>
    discussionReplyService.createReply({
      thread,
      user: { _id: studentIds[index % studentIds.length], role: 'student' },
      content: `<p>Concurrent reply ${index}</p>`,
      parentReplyId: rootIds[index % rootIds.length],
      idempotencyKey: `bench-${scenario.name}-${index}`,
    })
  );
  samples.concurrentReplyMs.push(...replyPost.samples);

  const duplicate = await Promise.all([
    discussionReplyService.createReply({
      thread,
      user: { _id: studentIds[0], role: 'student' },
      content: '<p>Duplicate check</p>',
      idempotencyKey: `duplicate-${scenario.name}`,
    }),
    discussionReplyService.createReply({
      thread,
      user: { _id: studentIds[0], role: 'student' },
      content: '<p>Duplicate check</p>',
      idempotencyKey: `duplicate-${scenario.name}`,
    }).catch((error) => ({ error: error.code || error.message })),
  ]);

  const markRead = await concurrentSamples(scenario.concurrency, (index) =>
    discussionParticipation.markThreadRead(thread._id, studentIds[index % studentIds.length])
  );
  samples.concurrentMarkReadMs.push(...markRead.samples);

  const moderationTargets = replyIds.slice(0, scenario.concurrency);
  const moderation = await concurrentSamples(Math.min(scenario.concurrency, moderationTargets.length), async (index) => {
    const replyId = moderationTargets[index];
    await discussionReplyService.hideReply({ replyId, user: { _id: studentIds[0] }, note: 'bench' });
    await discussionReplyService.restoreReply({ replyId, user: { _id: studentIds[0] }, note: 'bench' });
  });
  samples.concurrentModerationMs.push(...moderation.samples);

  const [collectionReplyCount, participationRows] = await Promise.all([
    DiscussionReply.countDocuments({ threadId: thread._id, deletedAt: null }),
    DiscussionParticipation.countDocuments({ threadId: thread._id }),
  ]);
  const refreshedThread = await Thread.findById(thread._id).select('counters').lean();
  const heapAfter = process.memoryUsage().heapUsed;
  const cpu = process.cpuUsage(cpuBefore);
  const timings = Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, summarize(values)]));
  const rootPayloadBytes = payloadBytes(rootPage?.replies || []);
  const childPayloadBytes = payloadBytes(childPage?.replies || []);
  const validations = {
    rootPageP95: timings.rootPageMs.p95 <= thresholds.rootPageP95Ms,
    childPageP95: timings.childPageMs.p95 <= thresholds.childPageP95Ms,
    concurrentPaginationP95: timings.concurrentPaginationMs.p95 <= thresholds.concurrentPaginationP95Ms,
    concurrentReplyP95: timings.concurrentReplyMs.p95 <= thresholds.concurrentReplyP95Ms,
    concurrentMarkReadP95: timings.concurrentMarkReadMs.p95 <= thresholds.concurrentMarkReadP95Ms,
    concurrentModerationP95: timings.concurrentModerationMs.p95 <= thresholds.concurrentModerationP95Ms,
    rootPayloadBounded: rootPayloadBytes <= thresholds.rootPayloadBytes,
    heapDeltaBounded: Math.max(0, heapAfter - heapBefore) <= thresholds.heapDeltaBytes,
    cpuUserBounded: cpu.user <= thresholds.cpuUserMicros,
    countersConsistent: refreshedThread?.counters?.replyCount === collectionReplyCount,
    participationPresent: participationRows > 0,
    duplicateSuppressed: duplicate.some((row) => row?.duplicateSuppressed === true || row?.error),
  };

  if (!keep) {
    await Promise.all([
      DiscussionReply.deleteMany({ threadId: thread._id }),
      DiscussionParticipation.deleteMany({ threadId: thread._id }),
      Thread.deleteOne({ _id: thread._id }),
    ]);
  }

  return {
    scenario: scenario.name,
    targets: scenario,
    durationMs: elapsed(startedAt),
    timings,
    wallClock: {
      concurrentPaginationMs: pagination.wallMs,
      concurrentReplyMs: replyPost.wallMs,
      concurrentMarkReadMs: markRead.wallMs,
      concurrentModerationMs: moderation.wallMs,
    },
    payloadBytes: {
      rootPage: rootPayloadBytes,
      childPage: childPayloadBytes,
    },
    memory: {
      heapBefore,
      heapAfter,
      heapDelta: heapAfter - heapBefore,
      rss: process.memoryUsage().rss,
    },
    cpu,
    gcPressure: {
      heapDeltaRatio: heapBefore > 0 ? Number(((heapAfter - heapBefore) / heapBefore).toFixed(4)) : 0,
    },
    slowQueryCounts: {
      over250ms: Object.values(samples).flat().filter((value) => value > 250).length,
      over1000ms: Object.values(samples).flat().filter((value) => value > 1000).length,
    },
    indexUsage: {
      certifiedSeparatelyBy: 'scripts/verify-discussion-indexes.js',
    },
    rootPage: {
      size: rootPage?.replies.length || 0,
      total: rootPage?.pagination.total || 0,
      nextCursor: Boolean(rootPage?.pagination.nextCursor),
    },
    childPage: {
      size: childPage?.replies.length || 0,
      nextCursor: Boolean(childPage?.pagination?.nextCursor),
    },
    consistency: {
      collectionReplyCount,
      threadCounterReplyCount: refreshedThread?.counters?.replyCount || 0,
      participationRows,
    },
    thresholds,
    validations,
    pass: Object.values(validations).every(Boolean),
  };
}

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });

  if (!apply) {
    console.log(JSON.stringify({
      apply,
      message: 'Dry run only. Use --apply to seed and benchmark temporary synthetic discussions.',
      scenarios: configuredScenario,
      pageLimit,
      sampleRuns,
      thresholds,
    }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const startedAt = Date.now();
  const staleSyntheticThreadsRemoved = keep ? 0 : await cleanupStaleSyntheticDiscussions();
  const scenarios = [];
  for (const scenario of configuredScenario) {
    scenarios.push(await runScenario(scenario));
  }
  const report = {
    apply,
    keep,
    generatedAt: new Date().toISOString(),
    durationMs: elapsed(startedAt),
    staleSyntheticThreadsRemoved,
    pageLimit,
    sampleRuns,
    thresholds,
    scenarios,
    pass: scenarios.every((scenario) => scenario.pass),
  };
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (!report.pass) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
