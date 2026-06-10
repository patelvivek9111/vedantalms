#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

async function connectMongo() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
  }
  return uri;
}

async function login(baseUrl, email, password) {
  const res = await axios.post(`${baseUrl}/api/auth/login`, { email, password }, { validateStatus: () => true });
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  return res.data.token;
}

function readFixture() {
  const manifest = path.join(process.cwd(), 'uploads', 'reports', 'capacity-fixtures.json');
  if (!fs.existsSync(manifest)) throw new Error('Run seed:capacity first');
  return JSON.parse(fs.readFileSync(manifest, 'utf8'));
}

async function timedGet(url, headers) {
  const started = Date.now();
  const res = await axios.get(url, { headers, validateStatus: () => true, timeout: 60000 });
  const bodyStr = JSON.stringify(res.data || {});
  return {
    ok: res.status >= 200 && res.status < 400,
    status: res.status,
    durationMs: Date.now() - started,
    payloadBytes: Buffer.byteLength(bodyStr, 'utf8'),
    body: res.data,
  };
}

async function explainQuery(model, filter, sort) {
  const coll = model.collection.name;
  const cursor = model.find(filter).sort(sort).limit(50);
  const explain = await cursor.explain('executionStats');
  const stats = explain.executionStats || explain.queryPlanner;
  return {
    collection: coll,
    filter,
    sort,
    nReturned: explain.executionStats?.nReturned,
    totalDocsExamined: explain.executionStats?.totalDocsExamined,
    totalKeysExamined: explain.executionStats?.totalKeysExamined,
    executionTimeMillis: explain.executionStats?.executionTimeMillis,
    winningPlan: explain.queryPlanner?.winningPlan,
    indexUsed: explain.queryPlanner?.winningPlan?.inputStage?.indexName
      || explain.queryPlanner?.winningPlan?.inputStage?.inputStage?.indexName,
    stage: explain.queryPlanner?.winningPlan?.stage,
  };
}

function writePerfReport(filename, payload) {
  const dir = path.join(process.cwd(), 'uploads', 'reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, filename);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  return out;
}

module.exports = {
  connectMongo,
  login,
  readFixture,
  timedGet,
  explainQuery,
  writePerfReport,
};
