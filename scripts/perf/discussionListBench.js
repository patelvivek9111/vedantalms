#!/usr/bin/env node
/**
 * Discussion list endpoint benchmark + Mongo explain.
 * Usage: node scripts/perf/discussionListBench.js
 */
const mongoose = require('mongoose');
const Thread = require('../../models/thread.model');
const {
  connectMongo,
  login,
  readFixture,
  timedGet,
  explainQuery,
  writePerfReport,
} = require('./scalabilityBenchCommon');

const BASE = process.env.LOAD_BASE_URL || 'http://localhost:5000';

async function main() {
  const uri = await connectMongo();
  const fixture = readFixture();
  const token = await login(BASE, fixture.students[0].email, fixture.password);
  const headers = { Authorization: `Bearer ${token}` };
  const courseId = fixture.course.id;

  const explain = await explainQuery(
    Thread,
    { course: new mongoose.Types.ObjectId(courseId), deletedAt: null },
    { lastActivity: -1 }
  );

  const samples = [];
  for (let i = 0; i < 5; i += 1) {
    samples.push(
      await timedGet(`${BASE}/api/threads/course/${courseId}?limit=50`, headers)
    );
  }

  const threadCount = await Thread.countDocuments({ course: courseId, deletedAt: null });
  const report = {
    benchmark: 'discussion-list',
    generatedAt: new Date().toISOString(),
    mongoUri: uri.replace(/\/\/.*@/, '//***@'),
    courseId,
    threadCount,
    explain,
    samples: samples.map((s) => ({
      ok: s.ok,
      status: s.status,
      durationMs: s.durationMs,
      payloadBytes: s.payloadBytes,
      threadRows: Array.isArray(s.body?.data) ? s.body.data.length : 0,
      pagination: s.body?.pagination || null,
    })),
    summary: {
      avgMs: Math.round(samples.reduce((a, s) => a + s.durationMs, 0) / samples.length),
      avgPayloadBytes: Math.round(samples.reduce((a, s) => a + s.payloadBytes, 0) / samples.length),
      errorRate: samples.filter((s) => !s.ok).length / samples.length,
    },
  };

  const out = writePerfReport('discussion-list-bench-latest.json', report);
  console.log(JSON.stringify({ ok: true, report: out, summary: report.summary, explain }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
