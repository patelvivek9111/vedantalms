#!/usr/bin/env node
/**
 * Lightweight gradebook timing smoke (requires running API + seeded course).
 * Usage: COURSE_ID=... TOKEN=... node scripts/perf/gradebookBench.js
 */
require('dotenv').config();
const axios = require('axios');

async function main() {
  const base = process.env.API_URL || 'http://localhost:5000';
  const courseId = process.env.COURSE_ID;
  const token = process.env.TOKEN;
  if (!courseId || !token) {
    console.error('Set COURSE_ID and TOKEN env vars');
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}` };
  const start = Date.now();
  const res = await axios.get(`${base}/api/grades/course/${courseId}/gradebook`, {
    headers,
    params: { page: 1, pageSize: 100 },
  });
  const ms = Date.now() - start;
  console.log(
    JSON.stringify(
      {
        ok: res.status === 200,
        durationMs: ms,
        students: res.data?.data?.pagination?.totalStudents,
        assignments: res.data?.data?.assignments?.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
