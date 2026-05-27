#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { recoverStuckTimedQuizAttempts } = require('../../services/timedQuizRecovery.service');

const apply = process.argv.includes('--apply');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const result = await recoverStuckTimedQuizAttempts({
    apply,
    limit: Number(process.env.TIMED_QUIZ_RECOVERY_LIMIT || 500),
    staleMinutes: Number(process.env.TIMED_QUIZ_STALE_MINUTES || 15),
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
