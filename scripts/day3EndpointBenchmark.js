const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const { buildLoadTestContext } = require('./lib/loadTestContext');

dotenv.config();

const BASE_URL = process.env.BENCH_BASE_URL || 'http://localhost:5000';
const REQUESTS_PER_PHASE = parseInt(process.env.DAY3_BENCH_REQUESTS || '12', 10);
const REQUEST_DELAY_MS = parseInt(process.env.DAY3_REQUEST_DELAY_MS || '350', 10);
const MAX_RETRIES_ON_429 = parseInt(process.env.DAY3_MAX_RETRIES_ON_429 || '3', 10);
/** Pause between endpoints so `/api/inbox` + `/api/grades` stay under the stricter write limiter (default 120/min). */
const INTER_ENDPOINT_PAUSE_MS = parseInt(process.env.DAY3_INTER_ENDPOINT_PAUSE_MS || '12000', 10);
const reportPath = path.resolve(process.cwd(), 'DAY_PROGRESS.md');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const timeRequest = async (url, token) => {
  let attempt = 0;
  while (attempt <= MAX_RETRIES_ON_429) {
    const start = process.hrtime.bigint();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (res.status !== 429) {
      return { status: res.status, elapsedMs };
    }
    attempt += 1;
    if (attempt > MAX_RETRIES_ON_429) {
      return { status: res.status, elapsedMs };
    }
    // Exponential backoff for rate-limit responses
    await sleep(500 * attempt);
  }
  return { status: 429, elapsedMs: 0 };
};

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number(sorted[idx].toFixed(2));
};

const summarize = (samples) => ({
  count: samples.length,
  p50: percentile(samples, 50),
  p95: percentile(samples, 95),
  p99: percentile(samples, 99),
  avg: Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2))
});

const runPhase = async (url, token, count) => {
  const times = [];
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line no-await-in-loop
    const result = await timeRequest(url, token);
    if (result.status >= 400) {
      throw new Error(`benchmark request failed (${result.status}) for ${url}`);
    }
    times.push(result.elapsedMs);
    // eslint-disable-next-line no-await-in-loop
    await sleep(REQUEST_DELAY_MS);
  }
  return summarize(times);
};

const benchmarkEndpoint = async (name, url, token) => {
  const cold = await runPhase(url, token, REQUESTS_PER_PHASE);
  const warm = await runPhase(url, token, REQUESTS_PER_PHASE);
  return { name, url, cold, warm, p95ImprovementMs: Number((cold.p95 - warm.p95).toFixed(2)) };
};

const main = async () => {
  const context = await buildLoadTestContext();
  const endpoints = [];
  endpoints.push({
    name: 'Inbox conversations',
    url: `${BASE_URL}/api/inbox/conversations?folder=inbox`,
    token: context.studentToken
  });
  if (context.conversationId) {
    endpoints.push({
      name: 'Inbox messages',
      url: `${BASE_URL}/api/inbox/conversations/${context.conversationId}/messages?limit=50`,
      token: context.studentToken
    });
  } else {
    console.warn('[day3] Skipping Inbox messages benchmark: no conversation found');
  }
  if (context.studentCourseId) {
    endpoints.push({
      name: 'Student course grade',
      url: `${BASE_URL}/api/grades/student/course/${context.studentCourseId}`,
      token: context.studentToken
    });
  } else {
    console.warn('[day3] Skipping student grade benchmark: no student course found');
  }
  if (context.teacherCourseId) {
    endpoints.push({
      name: 'Course class average',
      url: `${BASE_URL}/api/grades/course/${context.teacherCourseId}/average`,
      token: context.teacherToken
    });
  } else {
    console.warn('[day3] Skipping class average benchmark: no teacher course found');
  }
  if (endpoints.length === 0) {
    throw new Error('No benchmark endpoints available from current database state');
  }

  const results = [];
  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[i];
    if (i > 0 && INTER_ENDPOINT_PAUSE_MS > 0) {
      console.log(`[day3] Pausing ${INTER_ENDPOINT_PAUSE_MS}ms before next endpoint (write-tier rate limits)...`);
      // eslint-disable-next-line no-await-in-loop
      await sleep(INTER_ENDPOINT_PAUSE_MS);
    }
    // eslint-disable-next-line no-await-in-loop
    const benchmark = await benchmarkEndpoint(endpoint.name, endpoint.url, endpoint.token);
    results.push(benchmark);
  }

  const capturedAt = new Date().toISOString();
  const reportEntry = `
### Day 3 Benchmark ${capturedAt}

- Base URL: ${BASE_URL}
- Requests per phase: ${REQUESTS_PER_PHASE}
- Request delay: ${REQUEST_DELAY_MS}ms
- Inter-endpoint pause: ${INTER_ENDPOINT_PAUSE_MS}ms

| Endpoint | Cold p95 (ms) | Warm p95 (ms) | Improvement (ms) |
| --- | ---:| ---:| ---:|
${results.map(r => `| ${r.name} | ${r.cold.p95} | ${r.warm.p95} | ${r.p95ImprovementMs} |`).join('\n')}
`;

  await fs.appendFile(reportPath, `${reportEntry}\n`, 'utf8');
  console.log('[day3] Benchmark completed and appended to DAY_PROGRESS.md');
  console.log(reportEntry);
};

main()
  .catch(async (error) => {
    console.error('[day3] Benchmark failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
