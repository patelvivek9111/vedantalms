const { QuizSession, QuizResponse } = require('../models/quizwave.model');
const Redis = require('ioredis');

let cleanupRedis = null;
if (process.env.REDIS_URL) {
  cleanupRedis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null });
  cleanupRedis.connect().catch(() => {
    cleanupRedis = null;
  });
}

// Cleanup old quiz sessions (older than 1 day - keep data for 1 day)
const cleanupOldSessions = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    
    // Find old ended sessions
    const oldSessions = await QuizSession.find({
      status: 'ended',
      createdAt: { $lt: oneDayAgo }
    });

    if (oldSessions.length === 0) {
      console.log('✅ QuizWave: No old sessions to clean up');
      return { deletedCount: 0 };
    }

    const sessionIds = oldSessions.map(s => s._id);

    // Delete related responses
    const responseResult = await QuizResponse.deleteMany({ 
      session: { $in: sessionIds } 
    });

    // Delete old sessions
    const sessionResult = await QuizSession.deleteMany({
      status: 'ended',
      createdAt: { $lt: oneDayAgo }
    });

    console.log(`✅ QuizWave: Cleaned up ${sessionResult.deletedCount} old sessions and ${responseResult.deletedCount} responses`);

    return {
      deletedSessions: sessionResult.deletedCount,
      deletedResponses: responseResult.deletedCount
    };
  } catch (error) {
    console.error('❌ QuizWave cleanup error:', error);
    throw error;
  }
};

// Run cleanup on server start and then every 24 hours
const startCleanupScheduler = () => {
  const runWithLock = async () => {
    if (!cleanupRedis) {
      return cleanupOldSessions();
    }
    const lockKey = 'quizwave:cleanup:lock';
    const lockId = `${process.pid}:${Date.now()}`;
    const acquired = await cleanupRedis.set(lockKey, lockId, 'EX', 60 * 10, 'NX');
    if (!acquired) {
      return { skipped: true };
    }
    try {
      return await cleanupOldSessions();
    } finally {
      const existing = await cleanupRedis.get(lockKey);
      if (existing === lockId) {
        await cleanupRedis.del(lockKey);
      }
    }
  };

  // Run immediately on start
  runWithLock().catch(console.error);

  // Then run every 24 hours
  setInterval(() => {
    runWithLock().catch(console.error);
  }, 24 * 60 * 60 * 1000); // 24 hours

  console.log('✅ QuizWave: Auto-cleanup scheduler started (runs every 24 hours)');
};

module.exports = {
  cleanupOldSessions,
  startCleanupScheduler
};

