const { QuizSession, QuizResponse } = require('../models/quizwave.model');
const Redis = require('ioredis');

let cleanupRedis = null;
if (process.env.REDIS_URL) {
  cleanupRedis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    commandTimeout: 1000,
    enableOfflineQueue: false,
    retryStrategy: () => null
  });
  cleanupRedis.on('error', () => {
    cleanupRedis = null;
  });
  cleanupRedis.connect().catch(() => {
    cleanupRedis = null;
  });
}

// Cleanup old quiz sessions (older than 1 day - keep data for 1 day)
const cleanupOldSessions = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    
    const batchSize = Math.min(
      Math.max(parseInt(process.env.QUIZWAVE_CLEANUP_BATCH_SIZE || '500', 10), 1),
      5000
    );

    // Find a bounded batch so API or worker startup cannot retain large result sets.
    const oldSessions = await QuizSession.find({
      status: 'ended',
      createdAt: { $lt: oneDayAgo }
    })
      .select('_id')
      .limit(batchSize)
      .lean();

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
    const sessionResult = await QuizSession.deleteMany({ _id: { $in: sessionIds } });

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

let cleanupIntervalId = null;

// Run cleanup on server start and then every 24 hours
const startCleanupScheduler = () => {
  if (cleanupIntervalId) {
    console.log('QuizWave: Auto-cleanup scheduler already running');
    return;
  }

  const runWithLock = async () => {
    if (!cleanupRedis || cleanupRedis.status !== 'ready') {
      return cleanupOldSessions();
    }
    try {
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
    } catch (error) {
      cleanupRedis = null;
      return cleanupOldSessions();
    }
  };

  // Run immediately on start
  runWithLock().catch(console.error);

  // Then run every 24 hours
  cleanupIntervalId = setInterval(() => {
    runWithLock().catch(console.error);
  }, 24 * 60 * 60 * 1000); // 24 hours

  console.log('✅ QuizWave: Auto-cleanup scheduler started (runs every 24 hours)');
};

const stopCleanupScheduler = () => {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
};

module.exports = {
  cleanupOldSessions,
  startCleanupScheduler,
  stopCleanupScheduler,
};

