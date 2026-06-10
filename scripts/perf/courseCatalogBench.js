#!/usr/bin/env node
const mongoose = require('mongoose');
const {
  connectMongo,
  login,
  readFixture,
  timedGet,
  writePerfReport,
} = require('./scalabilityBenchCommon');

const BASE = process.env.LOAD_BASE_URL || 'http://localhost:5000';

async function main() {
  await connectMongo();
  const fixture = readFixture();
  const roles = [
    { label: 'student', email: fixture.students[0].email },
    { label: 'teacher', email: fixture.teacher.email },
    { label: 'admin', email: fixture.admin.email },
  ];

  const results = [];
  for (const role of roles) {
    const token = await login(BASE, role.email, fixture.password);
    const sample = await timedGet(`${BASE}/api/courses`, { Authorization: `Bearer ${token}` });
    const courses = sample.body?.data || [];
    const fieldKeys = courses[0] ? Object.keys(courses[0]) : [];
    results.push({
      role: role.label,
      ok: sample.ok,
      durationMs: sample.durationMs,
      payloadBytes: sample.payloadBytes,
      courseCount: courses.length,
      fieldsReturned: fieldKeys,
      studentsPopulated: courses[0]?.students?.[0]
        ? typeof courses[0].students[0] === 'object'
        : false,
      studentCountField: courses[0]?.studentCount ?? null,
      avgBytesPerCourse: courses.length ? Math.round(sample.payloadBytes / courses.length) : 0,
    });
  }

  const report = {
    benchmark: 'course-catalog',
    generatedAt: new Date().toISOString(),
    results,
  };
  const out = writePerfReport('course-catalog-bench-latest.json', report);
  console.log(JSON.stringify({ ok: true, report: out, results }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
