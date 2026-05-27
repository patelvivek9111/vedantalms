#!/usr/bin/env node
/**
 * Scheduled timed quiz expiry sweep.
 * Cron example: node workers/timedQuizSweepWorker.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { sweepExpiredTimedQuizAttempts } = require('../services/timedQuizAttempt.service');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB || 'lms',
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10),
  });

  const limit = parseInt(process.env.TIMED_QUIZ_SWEEP_LIMIT || '500', 10);
  const result = await sweepExpiredTimedQuizAttempts({ limit });
  console.log(JSON.stringify({ ok: true, ...result }));
}

main()
  .catch((err) => {
    console.error('timed quiz sweep failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
