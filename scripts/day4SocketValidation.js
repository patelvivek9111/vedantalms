/**
 * Day 4: validate operational signals for realtime / multi-instance readiness.
 * Fetches /health/ops on each configured base URL (same list style as Day 1).
 *
 * Env:
 * - APP_HEALTH_URLS or DAY4_HEALTH_URLS (comma-separated), default http://localhost:5000
 * - REDIS_URL (in .env when script loads): if set, warns when the running server reports redisAdapterEnabled=false
 * - DAY4_REQUIRE_REDIS_ADAPTER=true: exit 1 when REDIS_URL is set locally but the server still has the adapter off
 */

require('dotenv').config();

const parseUrlList = (raw) =>
  String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const main = async () => {
  const bases = parseUrlList(process.env.APP_HEALTH_URLS || process.env.DAY4_HEALTH_URLS || 'http://localhost:5000');
  const localRedisConfigured = Boolean(process.env.REDIS_URL);
  const strictRedis = process.env.DAY4_REQUIRE_REDIS_ADAPTER === 'true';
  const rows = [];

  for (const base of bases) {
    const url = `${base.replace(/\/$/, '')}/health/ops`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`GET ${url} failed with HTTP ${res.status}`);
    }
    const json = await res.json();
    rows.push({
      base,
      redisAdapterEnabled: Boolean(json.dependencies?.redisAdapterEnabled),
      redisAdapterError: json.dependencies?.redisAdapterError || null,
      socketThrottled: json.socketMetrics?.throttled ?? null,
      socketConnected: json.socketMetrics?.currentlyConnected ?? null,
      engineConnectionErrors: json.socketEngine?.connectionErrors ?? null
    });
  }

  let exitCode = 0;
  for (const row of rows) {
    if (localRedisConfigured && !row.redisAdapterEnabled) {
      console.warn(
        `[day4] WARN ${row.base}: .env has REDIS_URL but this server reports Socket.IO Redis adapter disabled (restart app with reachable Redis, or this is a different process than your shell). Multi-instance QuizWave needs the adapter.`
      );
      if (row.redisAdapterError) {
        console.warn(`[day4]      redisAdapterError: ${row.redisAdapterError}`);
      }
      if (strictRedis) {
        exitCode = 1;
      }
    }
  }

  console.log('[day4] Socket / ops snapshot:\n' + JSON.stringify(rows, null, 2));
  console.log('[day4] Manual multi-node check: run two app instances with the same REDIS_URL, start a quiz on node A, confirm students on node B receive broadcasts.');
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[day4] Validation failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
