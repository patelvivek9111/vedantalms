const { QuizSession, QuizResponse } = require('../models/quizwave.model');

// Cleanup old quiz sessions (older than 1 day - keep data for 1 day)
const cleanupOldSessions = async () => {
  try {
    // Validate date calculation
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    if (isNaN(oneDayAgo.getTime())) {
      throw new Error('Invalid date calculation for cleanup');
    }
    
    // Find old ended sessions
    const oldSessions = await QuizSession.find({
      status: 'ended',
      createdAt: { $lt: oneDayAgo }
    });

    if (!oldSessions || oldSessions.length === 0) {
      console.log('✅ QuizWave: No old sessions to clean up');
      return { 
        deletedSessions: 0,
        deletedResponses: 0
      };
    }

    // Validate sessionIds array
    const sessionIds = oldSessions
      .map(s => s && s._id ? s._id : null)
      .filter(id => id !== null);

    if (sessionIds.length === 0) {
      console.log('✅ QuizWave: No valid session IDs to clean up');
      return { 
        deletedSessions: 0,
        deletedResponses: 0
      };
    }

    // Delete related responses
    let responseResult;
    try {
      responseResult = await QuizResponse.deleteMany({ 
        session: { $in: sessionIds } 
      });
    } catch (responseError) {
      console.error('❌ QuizWave: Error deleting responses:', responseError);
      // Continue with session deletion even if response deletion fails
      responseResult = { deletedCount: 0 };
    }

    // Delete old sessions
    let sessionResult;
    try {
      sessionResult = await QuizSession.deleteMany({
        status: 'ended',
        createdAt: { $lt: oneDayAgo }
      });
    } catch (sessionError) {
      console.error('❌ QuizWave: Error deleting sessions:', sessionError);
      throw sessionError; // Re-throw as this is the main operation
    }

    // Validate results
    const deletedSessions = sessionResult && typeof sessionResult.deletedCount === 'number' 
      ? sessionResult.deletedCount 
      : 0;
    const deletedResponses = responseResult && typeof responseResult.deletedCount === 'number' 
      ? responseResult.deletedCount 
      : 0;

    console.log(`✅ QuizWave: Cleaned up ${deletedSessions} old sessions and ${deletedResponses} responses`);

    return {
      deletedSessions,
      deletedResponses
    };
  } catch (error) {
    console.error('❌ QuizWave cleanup error:', error);
    throw error;
  }
};

// Run cleanup on server start and then every 24 hours
const startCleanupScheduler = () => {
  // Validate interval calculation
  const intervalMs = 24 * 60 * 60 * 1000; // 24 hours
  if (!isFinite(intervalMs) || intervalMs <= 0) {
    console.error('❌ QuizWave: Invalid cleanup interval');
    return;
  }

  // Run immediately on start
  cleanupOldSessions().catch((error) => {
    console.error('❌ QuizWave: Initial cleanup failed:', error);
  });

  // Then run every 24 hours
  const intervalId = setInterval(() => {
    cleanupOldSessions().catch((error) => {
      console.error('❌ QuizWave: Scheduled cleanup failed:', error);
    });
  }, intervalMs);

  // Store interval ID for potential cleanup (if needed)
  if (global.quizwaveCleanupInterval) {
    clearInterval(global.quizwaveCleanupInterval);
  }
  global.quizwaveCleanupInterval = intervalId;

  console.log('✅ QuizWave: Auto-cleanup scheduler started (runs every 24 hours)');
};

module.exports = {
  cleanupOldSessions,
  startCleanupScheduler
};

