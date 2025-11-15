const { QuizSession, QuizResponse } = require('../models/quizwave.model');

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
  // Run immediately on start
  cleanupOldSessions().catch(console.error);

  // Then run every 24 hours
  setInterval(() => {
    cleanupOldSessions().catch(console.error);
  }, 24 * 60 * 60 * 1000); // 24 hours

  console.log('✅ QuizWave: Auto-cleanup scheduler started (runs every 24 hours)');
};

module.exports = {
  cleanupOldSessions,
  startCleanupScheduler
};

