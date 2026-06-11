#!/usr/bin/env node
/**
 * File preview / stream load bench — simulates student attachment preview traffic.
 *
 * Usage:
 *   npm run seed:capacity
 *   npm run test:load:file-preview
 *
 * Env:
 *   LOAD_BASE_URL=http://localhost:5000
 *   LOAD_FILE_ASSET_ID=<optional file asset id>
 *   LOAD_CONCURRENCY_LEVELS=100,250,500,1000,2500
 *   LOAD_PHASE_DURATION_MS=20000
 */
require('dotenv').config();
const mongoose = require('mongoose');
const {
  createHttpClient,
  timedRequest,
  summarizeLatencies,
  fetchOpsMetrics,
  writeReport,
  readFixtureManifest,
} = require('./loadBenchUtils');

const BASE = process.env.LOAD_BASE_URL || 'http://localhost:5000';
const LEVELS = (process.env.LOAD_CONCURRENCY_LEVELS || '100,250,500,1000,2500')
  .split(',')
  .map((v) => parseInt(v.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);
const PHASE_MS = parseInt(process.env.LOAD_PHASE_DURATION_MS || '20000', 10);
const THINK_MS = parseInt(process.env.LOAD_THINK_MS || '800', 10);
const COOLDOWN_MS = parseInt(process.env.LOAD_COOLDOWN_MS || '3000', 10);

async function safeLogin(client, email, password) {
  const started = Date.now();
  try {
    const res = await client.post(`${BASE}/api/auth/login`, { email, password });
    return {
      label: 'student_login',
      ok: res.status >= 200 && res.status < 400 && !!res.data?.token,
      status: res.status,
      durationMs: Date.now() - started,
      token: res.data?.token || null,
    };
  } catch (error) {
    return {
      label: 'student_login',
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      token: null,
      error: error.message,
    };
  }
}

async function timedDownloadTokenRequest(client, fileAssetId, headers) {
  const started = Date.now();
  const url = `${BASE}/api/files/${fileAssetId}/download-token`;
  try {
    const res = await client.post(url, null, { headers });
    const ok = res.status >= 200 && res.status < 400;
    return {
      label: 'file_download_token',
      ok,
      status: res.status,
      durationMs: Date.now() - started,
      token: ok ? res.data?.data?.token || null : null,
    };
  } catch (error) {
    return {
      label: 'file_download_token',
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      token: null,
      error: error.message,
    };
  }
}

async function timedStreamRequest(client, { url, headers, label }) {
  const started = Date.now();
  try {
    const res = await client.get(url, { headers, maxRedirects: 0, validateStatus: () => true });
    const ok = (res.status >= 200 && res.status < 400) || res.status === 302;
    return { label, ok, status: res.status, durationMs: Date.now() - started };
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveFileAssetId(client, token, fixture) {
  if (process.env.LOAD_FILE_ASSET_ID) {
    return process.env.LOAD_FILE_ASSET_ID;
  }

  const assignmentId = fixture.assignmentIds?.[0];
  if (assignmentId) {
    const res = await client.get(`${BASE}/api/assignments/${assignmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
    });
    const attachmentFiles = res.data?.attachmentFiles;
    if (Array.isArray(attachmentFiles) && attachmentFiles.length > 0) {
      const first = attachmentFiles[0];
      if (first?.fileAssetId) return String(first.fileAssetId);
    }
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms';
  await mongoose.connect(uri);
  try {
    const FileAsset = require('../../models/fileAsset.model');
    const asset = await FileAsset.findOne({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .select('_id')
      .lean();
    if (asset?._id) return String(asset._id);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }

  throw new Error(
    'No file asset found. Set LOAD_FILE_ASSET_ID or attach files to a capacity assignment before running this bench.'
  );
}

async function runPreviewSession(client, token, fileAssetId) {
  const headers = { Authorization: `Bearer ${token}` };
  const tokenRes = await timedDownloadTokenRequest(client, fileAssetId, headers);

  let streamUrl = `${BASE}/api/files/${fileAssetId}/stream`;
  if (tokenRes.token) {
    streamUrl += `?token=${encodeURIComponent(tokenRes.token)}`;
  }

  const { token: _unused, ...tokenSample } = tokenRes;

  return Promise.all([
    Promise.resolve(tokenSample),
    timedStreamRequest(client, { url: streamUrl, headers, label: 'file_stream' }),
    timedRequest(client, {
      method: 'get',
      url: `${BASE}/api/files/${fileAssetId}/metadata`,
      headers,
      label: 'file_metadata',
    }),
    timedRequest(client, {
      method: 'get',
      url: `${BASE}/api/files/${fileAssetId}/preview`,
      headers,
      label: 'file_preview_info',
    }),
  ]);
}

async function runPhase(concurrency, fixture, client, fileAssetId) {
  const phaseStarted = Date.now();
  const samples = [];
  const opsBefore = await fetchOpsMetrics(BASE, client);

  const workers = Array.from({ length: concurrency }, (_, i) => async () => {
    const student = fixture.students[i % fixture.students.length];
    const loginSample = await safeLogin(client, student.email, fixture.password);
    loginSample.phaseDurationMs = PHASE_MS;
    samples.push(loginSample);

    const token = loginSample.token;
    if (!token) return;

    while (Date.now() - phaseStarted < PHASE_MS) {
      const batch = await runPreviewSession(client, token, fileAssetId);
      batch.forEach((sample) => {
        samples.push({ ...sample, phaseDurationMs: PHASE_MS });
      });
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

  const overall = summarizeLatencies(samples);
  return {
    concurrency,
    phaseDurationMs: Date.now() - phaseStarted,
    overall,
    byLabel: Object.fromEntries(
      Object.entries(byLabel).map(([label, rows]) => [label, summarizeLatencies(rows)])
    ),
    opsBefore,
    opsAfter,
  };
}

async function main() {
  const fixture = readFixtureManifest();
  const client = createHttpClient(parseInt(process.env.LOAD_MAX_SOCKETS || '512', 10));
  const preflight = await safeLogin(client, fixture.students[0].email, fixture.password);
  if (!preflight.token) {
    throw new Error(`Login failed for ${fixture.students[0].email} (status=${preflight.status || 0})`);
  }

  const fileAssetId = await resolveFileAssetId(client, preflight.token, fixture);
  console.error(`[file-preview-bench] using fileAssetId=${fileAssetId}`);

  const results = [];
  for (const level of LEVELS) {
    console.error(`[file-preview-bench] concurrency=${level} durationMs=${PHASE_MS}`);
    try {
      const phase = await runPhase(level, fixture, client, fileAssetId);
      results.push(phase);
      console.error(
        `[file-preview-bench] concurrency=${level} errorRate=${(phase.overall.errorRate * 100).toFixed(2)}% p95=${phase.overall.p95Ms}ms stream429=${phase.byLabel.file_stream?.errors?.byStatus?.['429'] || 0}`
      );
    } catch (error) {
      console.error(`[file-preview-bench] concurrency=${level} failed: ${error.message}`);
      results.push({ concurrency: level, error: error.message, failed: true });
    }
    if (COOLDOWN_MS > 0) await sleep(COOLDOWN_MS);
  }

  const report = {
    bench: 'file_preview',
    baseUrl: BASE,
    fileAssetId,
    phaseDurationMs: PHASE_MS,
    levels: LEVELS,
    results,
    finishedAt: new Date().toISOString(),
  };

  const out = writeReport(`file-preview-load-${Date.now()}.json`, report);
  writeReport(process.env.LOAD_REPORT_LATEST || 'file-preview-load-latest.json', report);
  console.log(JSON.stringify({ ok: true, report: out, fileAssetId, results: results.map((r) => ({ concurrency: r.concurrency, ...r.overall })) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
