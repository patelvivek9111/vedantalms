#!/usr/bin/env node
/**
 * Repeatable planner feed benchmark (in-memory Mongo).
 * Usage: node scripts/perf/phase11cPlannerBench.js
 * Env: BENCH_SIZES=100,500,1000 BENCH_RUNS=3
 */
const mongoose = require('mongoose');
const plannerFeedService = require('../../services/planner/plannerFeed.service');
const {
  connectBenchMongo,
  seedCourseWithStudents,
  summarizeRuns,
} = require('./phase11cBenchCommon');

async function benchPlannerForSize(size, runs) {
  const { students } = await seedCourseWithStudents(size, { prefix: `planner-${size}` });
  const runResults = [];

  for (let i = 0; i < runs; i += 1) {
    const started = Date.now();
    try {
      const feeds = await Promise.all(
        students.map((student) =>
          plannerFeedService.buildPlannerFeedForUser(student._id, 'student')
        )
      );
      const failures = feeds.filter((feed) => !feed || !Array.isArray(feed.items)).length;
      runResults.push({
        ok: failures === 0,
        durationMs: Date.now() - started,
        users: students.length,
        failures,
      });
    } catch (error) {
      runResults.push({
        ok: false,
        durationMs: Date.now() - started,
        users: students.length,
        error: error?.message || String(error),
      });
    }
  }

  return {
    size,
    users: size,
    ...summarizeRuns(runResults),
    concurrency: size,
  };
}

async function main() {
  const sizes = (process.env.BENCH_SIZES || '100,500,1000')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const runs = parseInt(process.env.BENCH_RUNS || '3', 10);

  process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED = 'true';
  process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';

  const mongoServer = await connectBenchMongo();
  const results = [];

  try {
    for (const size of sizes) {
      results.push(await benchPlannerForSize(size, runs));
    }
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  console.log(
    JSON.stringify(
      {
        benchmark: 'phase11c-planner',
        timestamp: new Date().toISOString(),
        runsPerSize: runs,
        results,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
