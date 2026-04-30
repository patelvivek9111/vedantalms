/**
 * Day 5 — Load test round 1 (local ramp): raise concurrency, then snapshot /health/ops.
 *
 * Modes:
 * - Default: public read paths (`DAY5_PATHS`, default /health,/health/ready,/metrics)
 * - DAY5_MODE=api: JWT-backed hot routes (inbox, grades, messages if present); gentler defaults; needs MONGODB_URI + API up
 *
 * Env (public mode):
 * - DAY5_BASE_URL, DAY5_START_CONCURRENCY, DAY5_MAX_CONCURRENCY, DAY5_CONCURRENCY_STEP, DAY5_PHASE_DURATION_MS, DAY5_PATHS
 * Env (api mode):
 * - DAY5_API_START (default 1), DAY5_API_MAX (default 8), DAY5_API_STEP (default 1), DAY5_API_PHASE_MS (default 12000), DAY5_API_GAP_MS (default 200)
 */
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const { buildLoadTestContext } = require('./lib/loadTestContext');

const BASE = (process.env.DAY5_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const startConc = parseInt(process.env.DAY5_START_CONCURRENCY || '2', 10);
const maxConc = parseInt(process.env.DAY5_MAX_CONCURRENCY || '24', 10);
const step = parseInt(process.env.DAY5_CONCURRENCY_STEP || '2', 10);
const phaseMs = parseInt(process.env.DAY5_PHASE_DURATION_MS || '15000', 10);
const paths = (process.env.DAY5_PATHS || '/health,/health/ready,/metrics')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number(sorted[idx].toFixed(2));
};

async function runPhase(concurrency, durationMs) {
  const endAt = Date.now() + durationMs;
  const latencies = [];
  let errors = 0;
  let requests = 0;

  const worker = async (id) => {
    let n = id;
    while (Date.now() < endAt) {
      const p = paths[n % paths.length];
      n += concurrency;
      const t0 = Date.now();
      try {
        const res = await fetch(`${BASE}${p}`);
        requests += 1;
        latencies.push(Date.now() - t0);
        if (res.status === 429) {
          await sleep(500);
        }
      } catch {
        errors += 1;
      }
      await sleep(5);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  return {
    concurrency,
    requests,
    errors,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99)
  };
}

const fetchOps = async () => {
  const res = await fetch(`${BASE}/health/ops`);
  if (!res.ok) throw new Error(`/health/ops ${res.status}`);
  return res.json();
};

const main = async () => {
  const phases = [];
  for (let c = startConc; c <= maxConc; c += step) {
    // eslint-disable-next-line no-await-in-loop
    const row = await runPhase(c, phaseMs);
    phases.push(row);
    console.log(
      `[day5] phase conc=${row.concurrency} durationMs=${phaseMs} reqs=${row.requests} err=${row.errors} client_p95=${row.p95}ms`
    );
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
  }

  const ops = await fetchOps();
  const rm = ops.requestMetrics || {};
  const lat = rm.latencyMs || {};
  const summary = {
    base: BASE,
    paths,
    phases,
    healthOpsAfter: {
      total: rm.total,
      status5xx: rm.status5xx,
      errorRatePercent: rm.errorRatePercent,
      serverP95ms: lat.p95,
      mongoConnected: ops.dependencies?.mongoConnected,
      redisAdapter: ops.dependencies?.redisAdapterEnabled
    }
  };

  console.log('[day5] Summary:\n' + JSON.stringify(summary, null, 2));

  const reportPath = path.resolve(process.cwd(), 'DAY_PROGRESS.md');
  const stamp = new Date().toISOString();
  const entry = `
### Day 5 load ramp ${stamp}

- Base: ${BASE}
- Paths: ${paths.join(', ')}
- Phase duration: ${phaseMs}ms; concurrency ${startConc}..${maxConc} step ${step}

| Concurrency | Requests | Errors | Client p95 (ms) |
| --- | ---:| ---:| ---:|
${phases.map((p) => `| ${p.concurrency} | ${p.requests} | ${p.errors} | ${p.p95} |`).join('\n')}

- After ramp — /health/ops: total=${rm.total}, 5xx=${rm.status5xx}, server p95=${lat.p95}ms, mongo=${ops.dependencies?.mongoConnected}, redisAdapter=${ops.dependencies?.redisAdapterEnabled}

`;

  try {
    await fs.access(reportPath);
    await fs.appendFile(reportPath, entry, 'utf8');
    console.log('[day5] Appended summary to DAY_PROGRESS.md');
  } catch {
    console.warn('[day5] DAY_PROGRESS.md not found; skipped append');
  }
};

const buildApiTargets = (base, ctx) => {
  const targets = [];
  targets.push({ url: `${base}/api/inbox/conversations?folder=inbox`, token: ctx.studentToken });
  if (ctx.conversationId) {
    targets.push({
      url: `${base}/api/inbox/conversations/${ctx.conversationId}/messages?limit=50`,
      token: ctx.studentToken
    });
  }
  if (ctx.studentCourseId) {
    targets.push({
      url: `${base}/api/grades/student/course/${ctx.studentCourseId}`,
      token: ctx.studentToken
    });
  }
  if (ctx.teacherCourseId) {
    targets.push({
      url: `${base}/api/grades/course/${ctx.teacherCourseId}/average`,
      token: ctx.teacherToken
    });
  }
  return targets;
};

async function runPhaseApi(concurrency, durationMs, targets, gapMs) {
  const endAt = Date.now() + durationMs;
  const latencies = [];
  let errors = 0;
  let requests = 0;
  let throttled = 0;

  const worker = async (id) => {
    let n = id;
    while (Date.now() < endAt) {
      const t = targets[n % targets.length];
      n += concurrency;
      const t0 = Date.now();
      try {
        const res = await fetch(t.url, {
          headers: { Authorization: `Bearer ${t.token}` }
        });
        requests += 1;
        latencies.push(Date.now() - t0);
        if (res.status === 429) {
          throttled += 1;
          await sleep(800);
        } else if (res.status >= 400) {
          errors += 1;
        }
      } catch {
        errors += 1;
      }
      await sleep(gapMs);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  return {
    concurrency,
    requests,
    errors,
    throttled,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99)
  };
}

const mainApi = async () => {
  const apiStart = parseInt(process.env.DAY5_API_START || '1', 10);
  const apiMax = parseInt(process.env.DAY5_API_MAX || '8', 10);
  const apiStep = parseInt(process.env.DAY5_API_STEP || '1', 10);
  const apiPhaseMs = parseInt(process.env.DAY5_API_PHASE_MS || '12000', 10);
  const apiGapMs = parseInt(process.env.DAY5_API_GAP_MS || '200', 10);

  const ctx = await buildLoadTestContext();
  const targets = buildApiTargets(BASE, ctx);
  if (targets.length === 0) {
    throw new Error('No API targets (check DB for courses/inbox)');
  }
  console.log(`[day5] API mode: ${targets.length} endpoint(s), phases ${apiStart}..${apiMax} step ${apiStep}`);

  const phases = [];
  for (let c = apiStart; c <= apiMax; c += apiStep) {
    // eslint-disable-next-line no-await-in-loop
    const row = await runPhaseApi(c, apiPhaseMs, targets, apiGapMs);
    phases.push(row);
    console.log(
      `[day5] api phase conc=${row.concurrency} durationMs=${apiPhaseMs} reqs=${row.requests} err=${row.errors} 429=${row.throttled} client_p95=${row.p95}ms`
    );
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
  }

  const ops = await fetchOps();
  const rm = ops.requestMetrics || {};
  const lat = rm.latencyMs || {};
  const summary = {
    mode: 'api',
    base: BASE,
    targets: targets.map((x) => (x.url.startsWith(BASE) ? x.url.slice(BASE.length) : x.url)),
    phases,
    healthOpsAfter: {
      total: rm.total,
      status5xx: rm.status5xx,
      errorRatePercent: rm.errorRatePercent,
      serverP95ms: lat.p95,
      mongoConnected: ops.dependencies?.mongoConnected,
      redisAdapter: ops.dependencies?.redisAdapterEnabled
    }
  };

  console.log('[day5] API summary:\n' + JSON.stringify(summary, null, 2));

  const reportPath = path.resolve(process.cwd(), 'DAY_PROGRESS.md');
  const stamp = new Date().toISOString();
  const entry = `
### Day 5 API load ramp ${stamp}

- Base: ${BASE}
- Mode: api (JWT routes)
- Phase: ${apiPhaseMs}ms; concurrency ${apiStart}..${apiMax} step ${apiStep}; gap ${apiGapMs}ms

| Concurrency | Requests | Errors | 429 | Client p95 (ms) |
| --- | ---:| ---:| ---:| ---:|
${phases.map((p) => `| ${p.concurrency} | ${p.requests} | ${p.errors} | ${p.throttled} | ${p.p95} |`).join('\n')}

- After ramp — /health/ops: total=${rm.total}, 5xx=${rm.status5xx}, server p95=${lat.p95}ms, mongo=${ops.dependencies?.mongoConnected}, redisAdapter=${ops.dependencies?.redisAdapterEnabled}

`;

  try {
    await fs.access(reportPath);
    await fs.appendFile(reportPath, entry, 'utf8');
    console.log('[day5] Appended API summary to DAY_PROGRESS.md');
  } catch {
    console.warn('[day5] DAY_PROGRESS.md not found; skipped append');
  }
};

if (process.env.DAY5_MODE === 'api') {
  mainApi().catch((e) => {
    console.error('[day5] API load ramp failed:', e.message);
    process.exitCode = 1;
  }).finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
} else {
  main().catch((e) => {
    console.error('[day5] Load ramp failed:', e.message);
    process.exitCode = 1;
  });
}
