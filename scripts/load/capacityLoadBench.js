#!/usr/bin/env node
/**
 * VedantaLMS capacity load bench — realistic LMS traffic mix.
 * 70% student / 20% instructor / 10% admin sessions.
 *
 * Usage:
 *   node scripts/load/seedCapacityFixtures.js
 *   node scripts/load/capacityLoadBench.js
 *
 * Env:
 *   LOAD_BASE_URL=http://localhost:5000
 *   LOAD_CONCURRENCY_LEVELS=100,250,500,1000,1500,2500
 *   LOAD_PHASE_DURATION_MS=20000
 *   LOAD_FIXTURE_MANIFEST=uploads/reports/capacity-fixtures.json
 *
 * Requires PLANNER_UX_ENABLED=true on the API server (restart after changing .env).
 */
require('dotenv').config();
const {
  createHttpClient,
  timedRequest,
  summarizeLatencies,
  fetchOpsMetrics,
  writeReport,
  readFixtureManifest,
} = require('./loadBenchUtils');

const BASE = process.env.LOAD_BASE_URL || 'http://localhost:5000';
const LEVELS = (process.env.LOAD_CONCURRENCY_LEVELS || '100,250,500,1000,1500,2500')
  .split(',')
  .map((v) => parseInt(v.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);
const PHASE_MS = parseInt(process.env.LOAD_PHASE_DURATION_MS || '20000', 10);
const THINK_MS = parseInt(process.env.LOAD_THINK_MS || '1500', 10);
const COOLDOWN_MS = parseInt(process.env.LOAD_COOLDOWN_MS || '3000', 10);

async function safeLogin(client, email, password, role) {
  const started = Date.now();
  try {
    const res = await client.post(`${BASE}/api/auth/login`, { email, password });
    return {
      label: `${role}_login`,
      ok: res.status >= 200 && res.status < 400 && !!res.data?.token,
      status: res.status,
      durationMs: Date.now() - started,
      token: res.data?.token || null,
    };
  } catch (error) {
    return {
      label: `${role}_login`,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      token: null,
      error: error.message,
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertPlannerFeedEnabled(client, fixture) {
  const student = fixture.students[0];
  if (!student?.email) {
    throw new Error('Fixture manifest has no student accounts for preflight login.');
  }

  const login = await safeLogin(client, student.email, fixture.password, 'student');
  if (!login.token) {
    throw new Error(
      `Preflight login failed for ${student.email} (status=${login.status || 0}). Check LOAD_BASE_URL and capacity fixtures.`
    );
  }

  const res = await client.get(`${BASE}/api/planner/feed`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });

  if (res.status === 404 && res.data?.message === 'Not found') {
    throw new Error(
      'PLANNER_UX_ENABLED is not true on the API server. Set PLANNER_UX_ENABLED=true in .env and restart the server before running capacity load tests.'
    );
  }

  if (res.status < 200 || res.status >= 400) {
    throw new Error(
      `Preflight GET /api/planner/feed failed with status ${res.status}: ${res.data?.message || 'unknown error'}`
    );
  }
}

async function runStudentSession(client, token, fixture) {
  const headers = { Authorization: `Bearer ${token}` };
  const assignmentId = fixture.assignmentIds[0];
  const threadId = fixture.threadIds[0];
  const courseId = fixture.course.id;

  return Promise.all([
    timedRequest(client, { method: 'get', url: `${BASE}/api/auth/me`, headers, label: 'student_me' }),
    timedRequest(client, { method: 'get', url: `${BASE}/api/courses`, headers, label: 'student_courses' }),
    timedRequest(client, { method: 'get', url: `${BASE}/api/planner/feed`, headers, label: 'student_planner_feed' }),
    timedRequest(client, { method: 'get', url: `${BASE}/api/courses/${courseId}`, headers, label: 'student_course' }),
    timedRequest(client, {
      method: 'get',
      url: `${BASE}/api/assignments/${assignmentId}`,
      headers,
      label: 'student_assignment',
    }),
    timedRequest(client, {
      method: 'get',
      url: `${BASE}/api/threads/course/${courseId}`,
      headers,
      label: 'student_discussions',
    }),
    timedRequest(client, {
      method: 'get',
      url: `${BASE}/api/threads/${threadId}`,
      headers,
      label: 'student_thread',
    }),
    timedRequest(client, {
      method: 'get',
      url: `${BASE}/api/notifications/unread-count`,
      headers,
      label: 'student_notifications',
    }),
  ]);
}

async function runInstructorSession(client, token, fixture) {
  const headers = { Authorization: `Bearer ${token}` };
  const courseId = fixture.course.id;
  return Promise.all([
    timedRequest(client, { method: 'get', url: `${BASE}/api/courses`, headers, label: 'instructor_courses' }),
    timedRequest(client, { method: 'get', url: `${BASE}/api/planner/feed`, headers, label: 'instructor_planner_feed' }),
    timedRequest(client, {
      method: 'get',
      url: `${BASE}/api/grades/course/${courseId}/gradebook`,
      headers,
      label: 'instructor_gradebook',
      data: undefined,
    }),
    timedRequest(client, {
      method: 'get',
      url: `${BASE}/api/assignments/todo/ungraded`,
      headers,
      label: 'instructor_ungraded_todo',
    }),
  ]);
}

async function runAdminSession(client, token) {
  const headers = { Authorization: `Bearer ${token}` };
  return Promise.all([
    timedRequest(client, { method: 'get', url: `${BASE}/api/admin/users`, headers, label: 'admin_users' }),
    timedRequest(client, { method: 'get', url: `${BASE}/api/admin/courses`, headers, label: 'admin_courses' }),
    timedRequest(client, { method: 'get', url: `${BASE}/api/admin/stats`, headers, label: 'admin_stats' }),
    timedRequest(client, { method: 'get', url: `${BASE}/api/admin/analytics`, headers, label: 'admin_analytics' }),
  ]);
}

function pickRole(index, total) {
  const ratio = index / total;
  if (ratio < 0.7) return 'student';
  if (ratio < 0.9) return 'instructor';
  return 'admin';
}

async function runPhase(concurrency, fixture, client) {
  const phaseStarted = Date.now();
  const password = fixture.password;
  const samples = [];
  const opsBefore = await fetchOpsMetrics(BASE, client);

  const workers = Array.from({ length: concurrency }, (_, i) => async () => {
    const role = pickRole(i, concurrency);
    let email;
    if (role === 'student') {
      const student = fixture.students[i % fixture.students.length];
      email = student.email;
    } else if (role === 'instructor') {
      email = fixture.teacher.email;
    } else {
      email = fixture.admin.email;
    }

    const loginSample = await safeLogin(client, email, password, role);
    loginSample.phaseDurationMs = PHASE_MS;
    samples.push(loginSample);

    const token = loginSample.token;
    if (!token) return;

    while (Date.now() - phaseStarted < PHASE_MS) {
      let sessionResults = [];
      if (role === 'student') {
        sessionResults = await runStudentSession(client, token, fixture);
      } else if (role === 'instructor') {
        sessionResults = await runInstructorSession(client, token, fixture);
      } else {
        sessionResults = await runAdminSession(client, token);
      }

      for (const row of sessionResults) {
        row.phaseDurationMs = PHASE_MS;
        samples.push(row);
      }

      if (Date.now() - phaseStarted >= PHASE_MS) break;
      await sleep(THINK_MS);
    }
  });

  const pool = Math.min(concurrency, parseInt(process.env.LOAD_POOL_SIZE || '100', 10));
  let next = 0;
  async function poolWorker() {
    while (next < workers.length) {
      const idx = next;
      next += 1;
      await workers[idx]();
    }
  }
  await Promise.all(Array.from({ length: pool }, () => poolWorker()));

  const opsAfter = await fetchOpsMetrics(BASE, client);

  const byLabel = {};
  for (const sample of samples) {
    if (!byLabel[sample.label]) byLabel[sample.label] = [];
    byLabel[sample.label].push(sample);
  }

  const endpointSummaries = Object.entries(byLabel).map(([label, rows]) => ({
    label,
    ...summarizeLatencies(rows),
  }));

  const overall = summarizeLatencies(samples);
  return {
    concurrency,
    phaseDurationMs: Date.now() - phaseStarted,
    overall,
    endpoints: endpointSummaries.sort((a, b) => b.p95Ms - a.p95Ms),
    opsMetrics: opsAfter,
    opsDelta: opsBefore && opsAfter
      ? {
          requestTotalDelta: (opsAfter.requestMetrics?.total || 0) - (opsBefore.requestMetrics?.total || 0),
          errorRatePercent: opsAfter.requestMetrics?.errorRatePercent,
          latencyP95Ms: opsAfter.requestMetrics?.latencyMs?.p95,
        }
      : null,
  };
}

async function main() {
  const fixture = readFixtureManifest();
  const client = createHttpClient(parseInt(process.env.LOAD_MAX_SOCKETS || '1024', 10));
  await assertPlannerFeedEnabled(client, fixture);
  const results = [];

  for (const level of LEVELS) {
    console.error(`[capacity] running concurrency=${level} ...`);
    try {
      const phase = await runPhase(level, fixture, client);
      results.push(phase);
      console.error(
        `[capacity] concurrency=${level} errorRate=${(phase.overall.errorRate * 100).toFixed(2)}% p95=${phase.overall.p95Ms}ms throughput=${phase.overall.throughputRps}rps errors=${JSON.stringify(phase.overall.errors?.byType || {})}`
      );
    } catch (error) {
      console.error(`[capacity] concurrency=${level} failed: ${error.message}`);
      results.push({ concurrency: level, error: error.message, failed: true });
    }
    if (COOLDOWN_MS > 0) await sleep(COOLDOWN_MS);
  }

  const report = {
    benchmark: 'vedantalms-capacity-load',
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    fixtureCounts: fixture.counts,
    trafficMix: { student: 0.7, instructor: 0.2, admin: 0.1 },
    phaseDurationMs: PHASE_MS,
    levels: LEVELS,
    results,
  };

  const stamp = process.env.LOAD_REPORT_STAMP || `capacity-load-${Date.now()}`;
  const out = writeReport(`${stamp}.json`, report);
  writeReport(process.env.LOAD_REPORT_LATEST || 'capacity-load-latest.json', report);
  console.log(JSON.stringify({ ok: true, report: out, results: results.map((r) => ({ concurrency: r.concurrency, ...r.overall })) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
