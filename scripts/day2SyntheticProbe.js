/**
 * Day 2: generate light synthetic HTTP traffic and show /health/ops counter movement.
 *
 * Env:
 * - DAY2_SYNTHETIC_BASE_URL (default http://localhost:5000)
 * - DAY2_SYNTHETIC_ITERATIONS (default 40)
 */
require('dotenv').config();

const base = (process.env.DAY2_SYNTHETIC_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const iterations = parseInt(process.env.DAY2_SYNTHETIC_ITERATIONS || '40', 10);

const fetchOps = async () => {
  const res = await fetch(`${base}/health/ops`);
  if (!res.ok) {
    throw new Error(`/health/ops returned ${res.status}`);
  }
  return res.json();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const before = await fetchOps();
  const beforeTotal = before.requestMetrics?.total ?? 0;

  for (let i = 0; i < iterations; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all([
      fetch(`${base}/health`),
      fetch(`${base}/health/ready`),
      fetch(`${base}/metrics`)
    ]);
    // eslint-disable-next-line no-await-in-loop
    await sleep(5);
  }

  const after = await fetchOps();
  const afterTotal = after.requestMetrics?.total ?? 0;
  const delta = afterTotal - beforeTotal;
  const expectedApprox = iterations * 3;

  const summary = {
    base,
    iterations,
    requestTotalBefore: beforeTotal,
    requestTotalAfter: afterTotal,
    deltaRecorded: delta,
    expectedApproxTraffic: expectedApprox,
    latencyP95AfterMs: after.requestMetrics?.latencyMs?.p95,
    mongoUp: after.dependencies?.mongoConnected,
    redisAdapterUp: after.dependencies?.redisAdapterEnabled
  };

  console.log('[day2] Synthetic probe summary:\n' + JSON.stringify(summary, null, 2));
  if (delta < Math.max(1, iterations)) {
    console.warn('[day2] WARN: request total did not increase as expected (is the server running on this base URL?)');
    process.exitCode = 1;
  }
};

main().catch((e) => {
  console.error('[day2] Synthetic probe failed:', e.message);
  process.exitCode = 1;
});
