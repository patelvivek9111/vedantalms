#!/usr/bin/env node
/**
 * P3-5 CI gate: academic notification fanout benchmark with regression thresholds.
 * Uses in-memory Mongo — no MONGODB_URI required.
 */
const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const Notification = require('../models/notification.model');
const { notifyAssignmentPublished } = require('../services/notification/academicNotificationProducers.service');
const {
  connectBenchMongo,
  seedCourseWithStudents,
  summarizeRuns,
} = require('./perf/phase11cBenchCommon');

function readInt(name, fallback) {
  const parsed = parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function benchFanoutForSize(size, runs) {
  const { teacher, course, moduleDoc } = await seedCourseWithStudents(size, {
    prefix: `fanout-ci-${size}`,
  });

  const assignment = await Assignment.create({
    title: `Fanout CI ${size}`,
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
        error: error.message || String(error),
      });
    }
  }

  return {
    size,
    recipients: size,
    concurrency: readInt('ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY', 10),
    ...summarizeRuns(runResults),
  };
}

async function main() {
  const sizes = (process.env.BENCH_SIZES || '50,100')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const runs = readInt('BENCH_RUNS', 2);
  const minSuccessRate = Number(process.env.CI_FANOUT_MIN_SUCCESS_RATE || '1');
  const maxP95Ms = readInt('CI_FANOUT_MAX_P95_MS', 15000);

  process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
  process.env.NOTIFICATION_DEDUPE_ENABLED = 'false';
  process.env.NOTIFICATION_FANOUT_QUEUE_ENABLED = 'false';

  const mongoServer = await connectBenchMongo();
  const results = [];
  const violations = [];

  try {
    for (const size of sizes) {
      const row = await benchFanoutForSize(size, runs);
      results.push(row);
      if (row.successRate < minSuccessRate) {
        violations.push(`size ${size}: successRate ${row.successRate} < ${minSuccessRate}`);
      }
      if ((row.durationMs?.p95 || 0) > maxP95Ms) {
        violations.push(`size ${size}: p95 ${row.durationMs.p95}ms > ${maxP95Ms}ms`);
      }
    }
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  const payload = {
    ok: violations.length === 0,
    benchmark: 'phase11c-fanout-ci',
    timestamp: new Date().toISOString(),
    thresholds: { minSuccessRate, maxP95Ms },
    results,
    violations,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (violations.length) {
    console.error('verify:fanout-bench:ci FAILED');
    process.exit(1);
  }

  console.log('verify:fanout-bench:ci OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
