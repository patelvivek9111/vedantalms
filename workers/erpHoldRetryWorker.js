#!/usr/bin/env node
/**
 * Retry failed ERP hold webhook events (backoff / DLQ).
 * Cron: */15 * * * * node workers/erpHoldRetryWorker.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { retryDueEvents } = require('../services/integrations/erpHoldWebhook.service');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const report = await retryDueEvents({ limit: 100 });
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  const failed = (report.results || []).some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
