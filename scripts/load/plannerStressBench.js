#!/usr/bin/env node
/**
 * Planner feed stress bench — concurrent student feeds at scale.
 * Env: BENCH_SIZES=100,500,1000,2500 BENCH_RUNS=1
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../tests/mongoMemoryServer');
const plannerFeedService = require('../../services/planner/plannerFeed.service');
const Assignment = require('../../models/Assignment');
const { seedCourseWithStudents, summarizeRuns } = require('../perf/phase11cBenchCommon');
const { writeReport } = require('./loadBenchUtils');

async function benchPlannerForSize(size, runs) {
  const { teacher, students, course, moduleDoc } = await seedCourseWithStudents(size, {
    prefix: `planner-stress-${size}`,
  });

  const now = Date.now();
  const assignments = [];
  for (let i = 0; i < 50; i += 1) {
    assignments.push({
      title: `Planner Stress A${i}`,
      description: 'Load',
      module: moduleDoc._id,
      availableFrom: new Date(now - 14 * 86400000),
      dueDate: new Date(now + (i % 14) * 86400000),
      createdBy: teacher._id,
      published: true,
    });
  }
  await Assignment.insertMany(assignments);

  process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED = 'true';
  process.env.PLANNER_UX_ENABLED = 'true';

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
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      });
    } catch (error) {
      runResults.push({
        ok: false,
        durationMs: Date.now() - started,
        users: students.length,
        error: error.message,
      });
    }
  }

  return {
    users: size,
    courseId: String(course._id),
    assignmentsSeeded: assignments.length,
    ...summarizeRuns(runResults),
    concurrency: size,
  };
}

async function main() {
  const sizes = (process.env.BENCH_SIZES || '100,500,1000,2500')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const runs = parseInt(process.env.BENCH_RUNS || '1', 10);

  const mongoServer = await createMongoMemoryServer();
  await mongoose.connect(mongoServer.getUri());

  const results = [];
  try {
    for (const size of sizes) {
      results.push(await benchPlannerForSize(size, runs));
    }
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  const report = {
    benchmark: 'planner-stress',
    generatedAt: new Date().toISOString(),
    results,
  };

  const out = writeReport('planner-stress-latest.json', report);
  console.log(JSON.stringify({ ok: true, report: out, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
