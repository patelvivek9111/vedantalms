const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const axios = require('axios');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

function classifySampleError(sample) {
  if (sample.ok) return null;
  if (!sample.status) {
    const err = sample.error || 'network_error';
    if (/ECONNREFUSED/i.test(err)) return 'ECONNREFUSED';
    if (/ETIMEDOUT|ECONNABORTED|timeout/i.test(err)) return 'timeout';
    return err.split(/\s+/)[0] || 'network_error';
  }
  if (sample.status >= 500) return `http_${sample.status}`;
  if (sample.status >= 400) return `http_${sample.status}`;
  return `http_${sample.status}`;
}

function summarizeErrorBreakdown(samples) {
  const failed = samples.filter((s) => !s.ok);
  const byType = {};
  const byStatus = {};
  for (const s of failed) {
    const type = classifySampleError(s);
    byType[type] = (byType[type] || 0) + 1;
    const statusKey = String(s.status || 0);
    byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;
  }
  return {
    failed: failed.length,
    byType,
    byStatus,
  };
}

function summarizeLatencies(samples) {
  const sorted = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const ok = samples.filter((s) => s.ok);
  return {
    count: samples.length,
    ok: ok.length,
    failed: samples.length - ok.length,
    errorRate: samples.length ? (samples.length - ok.length) / samples.length : 0,
    avgMs: sorted.length
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : 0,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted[sorted.length - 1] || 0,
    throughputRps:
      samples.length && samples[0].phaseDurationMs
        ? Number((samples.length / (samples[0].phaseDurationMs / 1000)).toFixed(2))
        : null,
    errors: summarizeErrorBreakdown(samples),
  };
}

function createHttpClient(maxSockets = 512) {
  const agentOptions = { keepAlive: true, maxSockets };
  return axios.create({
    timeout: parseInt(process.env.LOAD_REQUEST_TIMEOUT_MS || '30000', 10),
    validateStatus: () => true,
    httpAgent: new http.Agent(agentOptions),
    httpsAgent: new https.Agent(agentOptions),
  });
}

async function timedRequest(client, { method = 'get', url, headers, data, label }) {
  const started = Date.now();
  try {
    const res = await client.request({ method, url, headers, data });
    const ok = res.status >= 200 && res.status < 400;
    return {
      label,
      ok,
      status: res.status,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      label,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: error.message,
    };
  }
}

async function fetchOpsMetrics(baseUrl, client) {
  try {
    const res = await client.get(`${baseUrl}/health/ops`);
    if (res.status !== 200) return null;
    return res.data;
  } catch {
    return null;
  }
}

function ensureReportDir() {
  const dir = path.join(process.cwd(), 'uploads', 'reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeReport(filename, payload) {
  const dir = ensureReportDir();
  const out = path.join(dir, filename);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  return out;
}

function readFixtureManifest() {
  const manifestPath =
    process.env.LOAD_FIXTURE_MANIFEST ||
    path.join(process.cwd(), 'uploads', 'reports', 'capacity-fixtures.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Fixture manifest not found: ${manifestPath}. Run seed:capacity first.`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

module.exports = {
  percentile,
  classifySampleError,
  summarizeErrorBreakdown,
  summarizeLatencies,
  createHttpClient,
  timedRequest,
  fetchOpsMetrics,
  ensureReportDir,
  writeReport,
  readFixtureManifest,
};
