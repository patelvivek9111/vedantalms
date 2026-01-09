const { QuizSession, QuizResponse } = require('../models/quizwave.model');

// Cleanup old quiz sessions (24 hours after they ended)
const cleanupOldSessions = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find old ended sessions that ended more than 24 hours ago
    const oldSessions = await QuizSession.find({
      status: 'ended',
      endedAt: { 
        $exists: true,
        $lt: twentyFourHoursAgo 
      }
    });

    if (oldSessions.length === 0) {
      console.log('✅ QuizWave: No old sessions to clean up');
      return { 
        deletedSessions: 0,
        deletedResponses: 0 
      };
    }

    const sessionIds = oldSessions.map(s => s._id);

    // Delete related responses
    const responseResult = await QuizResponse.deleteMany({ 
      session: { $in: sessionIds } 
    });

    // Delete old sessions
    const sessionResult = await QuizSession.deleteMany({
      status: 'ended',
      endedAt: { 
        $exists: true,
        $lt: twentyFourHoursAgo 
      }
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

// Run cleanup on server start and then daily
const startCleanupScheduler = () => {
  // Run immediately on start
  cleanupOldSessions().catch(console.error);

  // Then run every 24 hours (daily)
  setInterval(() => {
    cleanupOldSessions().catch(console.error);
  }, 24 * 60 * 60 * 1000); // 24 hours

  console.log('✅ QuizWave: Auto-cleanup scheduler started (runs daily, deletes sessions ended 24+ hours ago)');
};

module.exports = {
  cleanupOldSessions,
  startCleanupScheduler
};

