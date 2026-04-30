/**
 * Day 2: evaluate /health/ops against suggested thresholds (no external alerting system).
 * Use after synthetic probe or under load. Exit 1 if any critical condition fires.
 *
 * Env: DAY2_ALERT_BASE_URL (default http://localhost:5000)
 */
require('dotenv').config();

const base = (process.env.DAY2_ALERT_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const main = async () => {
  const res = await fetch(`${base}/health/ops`);
  if (!res.ok) {
    throw new Error(`/health/ops ${res.status}`);
  }
  const j = await res.json();
  const lat = j.requestMetrics?.latencyMs || {};
  const total = j.requestMetrics?.total || 0;
  const five = j.requestMetrics?.status5xx || 0;
  const four = j.requestMetrics?.status4xx || 0;
  const fiveRate = total > 0 ? (five / total) * 100 : 0;
  const fourRate = total > 0 ? (four / total) * 100 : 0;
  const mongo = Boolean(j.dependencies?.mongoConnected);
  const redisAd = Boolean(j.dependencies?.redisAdapterEnabled);
  const requireRedis = process.env.REQUIRE_REDIS === 'true';

  const findings = [];

  if (lat.p95 > 400) findings.push({ level: 'warn', msg: `API p95 ${lat.p95}ms > 400ms` });
  if (lat.p99 > 1200) findings.push({ level: 'warn', msg: `API p99 ${lat.p99}ms > 1200ms` });
  // Critical matches SLO "5xx rate": client/auth 4xx spikes are tracked separately as a warning.
  if (fiveRate > 1 && total >= 20) {
    findings.push({ level: 'critical', msg: `5xx rate ${fiveRate.toFixed(2)}% > 1% (n=${total})` });
  }
  if (fourRate > 25 && total >= 50) {
    findings.push({ level: 'warn', msg: `4xx rate ${fourRate.toFixed(2)}% > 25% (n=${total}) — check auth or bad clients` });
  }
  if (!mongo) findings.push({ level: 'critical', msg: 'Mongo disconnected' });
  if (requireRedis && !redisAd) findings.push({ level: 'critical', msg: 'Redis adapter off while REQUIRE_REDIS=true' });

  console.log('[day2] Alert dry-run against /health/ops thresholds');
  if (findings.length === 0) {
    console.log('[day2] No threshold violations at this snapshot.');
    return;
  }
  for (const f of findings) {
    console.log(`[day2] ${f.level.toUpperCase()}: ${f.msg}`);
  }
  if (findings.some((f) => f.level === 'critical')) {
    process.exitCode = 1;
  }
};

main().catch((e) => {
  console.error('[day2] Dry-run failed:', e.message);
  process.exitCode = 1;
});
