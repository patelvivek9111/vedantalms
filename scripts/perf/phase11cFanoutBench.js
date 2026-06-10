#!/usr/bin/env node
/**
 * Repeatable academic notification fanout benchmark (in-memory Mongo).
 * Usage: node scripts/perf/phase11cFanoutBench.js
 * Env: BENCH_SIZES=100,500,1000 BENCH_RUNS=3 ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY=10
 */
const mongoose = require('mongoose');
const Assignment = require('../../models/Assignment');
const Notification = require('../../models/notification.model');
const { notifyAssignmentPublished } = require('../../services/notification/academicNotificationProducers.service');
const {
  connectBenchMongo,
  seedCourseWithStudents,
  summarizeRuns,
} = require('./phase11cBenchCommon');

async function benchFanoutForSize(size, runs) {
  const { teacher, course, moduleDoc } = await seedCourseWithStudents(size, {
    prefix: `fanout-${size}`,
  });

  const assignment = await Assignment.create({
    title: `Fanout Bench ${size}`,
    description: 'Notify',
    module: moduleDoc._id,
    availableFrom: new Date(Date.now() - 86400000),
    dueDate: new Date(Date.now() + 5 * 86400000),
    createdBy: teacher._id,
    published: true,
  });

  const runResults = [];

  for (let i = 0; i < runs; i += 1) {
    await Notification.deleteMany({});
    const started = Date.now();
    try {
      const result = await notifyAssignmentPublished({
        assignment,
        course,
        actor: teacher,
      });
      const delivered = result?.delivered ?? 0;
      const failed = result?.failed ?? 0;
      const count = await Notification.countDocuments({});
      runResults.push({
        ok: failed === 0 && delivered === size,
        durationMs: Date.now() - started,
        delivered,
        failed,
        notificationCount: count,
      });
    } catch (error) {
      runResults.push({
        ok: false,
        durationMs: Date.now() - started,
        error: error?.message || String(error),
      });
    }
  }

  return {
    size,
    recipients: size,
    concurrency: parseInt(process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY || '10', 10),
    ...summarizeRuns(runResults),
  };
}

async function main() {
  const sizes = (process.env.BENCH_SIZES || '100,500,1000')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const runs = parseInt(process.env.BENCH_RUNS || '3', 10);

  process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
  process.env.NOTIFICATION_DEDUPE_ENABLED = 'false';

  const mongoServer = await connectBenchMongo();
  const results = [];

  try {
    for (const size of sizes) {
      results.push(await benchFanoutForSize(size, runs));
    }
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  console.log(
    JSON.stringify(
      {
        benchmark: 'phase11c-fanout',
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
