#!/usr/bin/env node
/**
 * U20.3 — Pre-release health verification (deps, queue, integrity signals).
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { isRedisConfigured } = require('../utils/bullmqConnection');
const AsyncJob = require('../models/asyncJob.model');
const { getFileOpsMetrics } = require('../services/fileOpsMetrics.service');

dotenv.config();

async function main() {
  const report = {
    checkedAt: new Date().toISOString(),
    checks: [],
    ok: true,
  };

  const push = (name, pass, detail = {}) => {
    report.checks.push({ name, pass, ...detail });
    if (!pass) report.ok = false;
  };

  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    push('mongo', mongoose.connection.readyState === 1);
  } catch (e) {
    push('mongo', false, { error: e.message });
  }

  push('redis_configured', isRedisConfigured(), {
    note: isRedisConfigured() ? 'BullMQ available' : 'Jobs run inline/degraded',
  });

  try {
    const [pending, failed] = await Promise.all([
      AsyncJob.countDocuments({ status: { $in: ['pending', 'active'] } }),
      AsyncJob.countDocuments({ status: 'failed' }),
    ]);
    push('async_queue', failed < 500, { pending, failed });
  } catch (e) {
    push('async_queue', false, { error: e.message });
  }

  try {
    const metrics = await getFileOpsMetrics();
    const unsafe = metrics?.unsafeCount ?? 0;
    push('file_governance', unsafe < 50, { unsafe, metrics });
  } catch (e) {
    push('file_governance', false, { error: e.message });
  }

  const fs = require('fs');
  const path = require('path');
  const reportDir = path.join(process.cwd(), 'uploads', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const out = path.join(reportDir, 'production-health.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect().catch(() => {});
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
