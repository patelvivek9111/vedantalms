/**
 * End all in-progress QuizWave sessions (E2E cleanup).
 * Usage: node scripts/endActiveQuizWaveSessions.js
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { QuizSession } = require('../models/quizwave.model');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('[e2e] MONGODB_URI is not set — skipping QuizWave session cleanup');
    process.exit(0);
  }

  await mongoose.connect(uri);
  const result = await QuizSession.updateMany(
    { status: { $in: ['waiting', 'active', 'paused'] } },
    { $set: { status: 'ended', endedAt: new Date(), phase: 'FINISHED' } }
  );
  console.log(`[e2e] ended ${result.modifiedCount} active QuizWave session(s)`);
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('[e2e] QuizWave session cleanup failed:', err);
  process.exit(1);
});
