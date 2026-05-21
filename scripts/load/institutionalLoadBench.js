#!/usr/bin/env node
/**
 * U18.1 — Staging load bench (synthetic API timing; run against staging with BASE_URL + TOKEN).
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const BASE = process.env.LOAD_BASE_URL || process.env.API_URL || 'http://localhost:5000';
const TOKEN = process.env.LOAD_AUTH_TOKEN || '';
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || 10);
const ROUNDS = Number(process.env.LOAD_ROUNDS || 5);

const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

async function timed(label, fn) {
  const start = Date.now();
  let ok = true;
  let status = 200;
  try {
    const res = await fn();
    status = res?.status || 200;
  } catch (e) {
    ok = false;
    status = e.response?.status || 0;
  }
  return { label, ms: Date.now() - start, ok, status };
}

async function runScenario(name, pathSuffix, method = 'get') {
  const samples = [];
  for (let r = 0; r < ROUNDS; r += 1) {
    const batch = Array.from({ length: CONCURRENCY }, () =>
      timed(name, () =>
        axios({ method, url: `${BASE}${pathSuffix}`, headers, timeout: 30000, validateStatus: () => true })
      )
    );
    samples.push(...(await Promise.all(batch)));
  }
  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  return {
    name,
    samples: samples.length,
    okRate: samples.filter((s) => s.ok).length / samples.length,
    p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
    p95,
    max: latencies[latencies.length - 1] || 0,
  };
}

async function main() {
  const courseId = process.env.LOAD_COURSE_ID;
  const scenarios = [
    await runScenario('health', '/api/health'),
    await runScenario('courses_list', '/api/courses'),
  ];
  if (courseId) {
    scenarios.push(await runScenario('gradebook', `/api/grades/course/${courseId}`));
    scenarios.push(await runScenario('discussions', `/api/threads/course/${courseId}`));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    concurrency: CONCURRENCY,
    rounds: ROUNDS,
    scenarios,
    notes: [
      'Set LOAD_BASE_URL, LOAD_AUTH_TOKEN, LOAD_COURSE_ID for full institutional paths.',
      '10k-user simulation requires seeded staging DB + horizontal workers.',
    ],
  };

  const dir = path.join(process.cwd(), 'uploads', 'reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'load-test-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Wrote ${out}`);
  const fail = scenarios.some((s) => s.okRate < 0.9);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
