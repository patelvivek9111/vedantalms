#!/usr/bin/env node
/**
 * Gradebook page build benchmark (service-level).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectMongo, readFixture, writePerfReport } = require('./scalabilityBenchCommon');
const { getCourseGradebookPage } = require('../../services/gradebookData.service');

async function main() {
  await connectMongo();
  const fixture = readFixture();
  const courseId = fixture.course.id;

  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const started = Date.now();
    const page = await getCourseGradebookPage(courseId, { page: 1, pageSize: 50 });
    runs.push({
      ok: true,
      durationMs: Date.now() - started,
      students: page.pagination?.totalStudents,
      pageStudents: page.students?.length,
      assignments: page.assignments?.length,
    });
  }

  const report = {
    benchmark: 'gradebook-page',
    generatedAt: new Date().toISOString(),
    courseId,
    runs,
    summary: {
      avgMs: Math.round(runs.reduce((a, r) => a + r.durationMs, 0) / runs.length),
      minMs: Math.min(...runs.map((r) => r.durationMs)),
      maxMs: Math.max(...runs.map((r) => r.durationMs)),
    },
  };

  const out = writePerfReport('gradebook-bench-latest.json', report);
  console.log(JSON.stringify({ ok: true, report: out, summary: report.summary }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
