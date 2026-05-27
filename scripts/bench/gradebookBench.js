#!/usr/bin/env node
/**
 * Gradebook scale smoke benchmark.
 *
 * Requires a running API and an instructor/admin token.
 * Usage:
 *   COURSE_ID=... TOKEN=... node scripts/bench/gradebookBench.js
 */
require('dotenv').config();
const axios = require('axios');

async function measurePage({ base, courseId, token, page, pageSize }) {
  const startHeap = process.memoryUsage().heapUsed;
  const start = Date.now();
  const res = await axios.get(`${base}/api/grades/course/${courseId}/gradebook`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { page, pageSize },
  });
  const durationMs = Date.now() - start;
  const payload = JSON.stringify(res.data || {});
  const endHeap = process.memoryUsage().heapUsed;
  return {
    page,
    pageSize,
    ok: res.status === 200,
    durationMs,
    payloadBytes: Buffer.byteLength(payload),
    heapDeltaBytes: endHeap - startHeap,
    students: res.data?.data?.students?.length || 0,
    assignments: res.data?.data?.assignments?.length || 0,
    pagination: res.data?.data?.pagination || null,
  };
}

async function main() {
  const base = process.env.API_URL || 'http://localhost:5000';
  const courseId = process.env.COURSE_ID;
  const token = process.env.TOKEN;
  const pageSize = Number(process.env.PAGE_SIZE || 100);
  const pages = Number(process.env.PAGES || 5);

  if (!courseId || !token) {
    console.error('Set COURSE_ID and TOKEN for an instructor/admin user.');
    process.exit(1);
  }

  const results = [];
  for (let page = 1; page <= pages; page += 1) {
    results.push(await measurePage({ base, courseId, token, page, pageSize }));
  }

  const firstPage = results[0];
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const p95 = durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)];

  console.log(
    JSON.stringify(
      {
        ok: firstPage?.durationMs < 3000,
        target: 'first page < 3000ms; stable paginated payloads',
        firstPageDurationMs: firstPage?.durationMs,
        p95DurationMs: p95,
        totalHeapDeltaBytes: results.reduce((sum, r) => sum + r.heapDeltaBytes, 0),
        results,
      },
      null,
      2
    )
  );

  if (!firstPage || firstPage.durationMs >= 3000) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
