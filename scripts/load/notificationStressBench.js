#!/usr/bin/env node
/**
 * Notification fanout stress bench (service-level + optional API publish).
 * Env: BENCH_SIZES=100,500,1000,2500 ACADEMIC_NOTIFICATION_EXPANSION_ENABLED=true
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../tests/mongoMemoryServer');
const Assignment = require('../../models/Assignment');
const Notification = require('../../models/notification.model');
const { notifyAssignmentPublished } = require('../../services/notification/academicNotificationProducers.service');
const { seedCourseWithStudents, summarizeRuns } = require('../perf/phase11cBenchCommon');

async function benchFanoutForSize(size, runs) {
  const { teacher, course, moduleDoc } = await seedCourseWithStudents(size, {
    prefix: `notify-stress-${size}`,
  });

  const assignment = await Assignment.create({
    title: `Notify Stress ${size}`,
    description: 'Fanout',
    module: moduleDoc._id,
    availableFrom: new Date(Date.now() - 86400000),
    dueDate: new Date(Date.now() + 5 * 86400000),
    createdBy: teacher._id,
    published: true,
  });

  process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
  process.env.NOTIFICATION_DEDUPE_ENABLED = process.env.NOTIFICATION_DEDUPE_ENABLED || 'true';

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
      const count = await Notification.countDocuments({});
      runResults.push({
        ok: (result?.failed ?? 0) === 0 && (result?.delivered ?? 0) === size,
        durationMs: Date.now() - started,
        delivered: result?.delivered ?? 0,
        failed: result?.failed ?? 0,
        suppressed: result?.suppressed ?? 0,
        skipped: result?.skipped ?? 0,
        notificationCount: count,
        dedupeEnabled: process.env.NOTIFICATION_DEDUPE_ENABLED === 'true',
      });
    } catch (error) {
      runResults.push({
        ok: false,
        durationMs: Date.now() - started,
        error: error.message,
      });
    }
  }

  return {
    recipients: size,
    concurrency: parseInt(process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY || '10', 10),
    ...summarizeRuns(runResults),
    runs: runResults,
  };
}

async function main() {
  const sizes = (process.env.BENCH_SIZES || '100,500,1000,2500')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const runs = parseInt(process.env.BENCH_RUNS || '2', 10);

  const mongoServer = await createMongoMemoryServer();
  await mongoose.connect(mongoServer.getUri());
  await Notification.syncIndexes();

  const results = [];
  try {
    for (const size of sizes) {
      results.push(await benchFanoutForSize(size, runs));
    }
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  const report = {
    benchmark: 'notification-fanout-stress',
    generatedAt: new Date().toISOString(),
    event: 'assignment.published',
    dedupeEnabled: process.env.NOTIFICATION_DEDUPE_ENABLED === 'true',
    results,
  };

  const { writeReport: write } = require('./loadBenchUtils');
  const out = write('notification-stress-latest.json', report);
  console.log(JSON.stringify({ ok: true, report: out, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
