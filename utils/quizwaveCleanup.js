const QuizSession = require('../models/quizwave.model').QuizSession;
const QuizResponse = require('../models/quizwave.model').QuizResponse;
const logger = require('./logger');

/**
 * Cleanup old QuizWave sessions (2-day retention)
 * Deletes sessions that ended more than 2 days ago
 */
const cleanupOldSessions = async () => {
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    
    // Find old sessions
    const oldSessions = await QuizSession.find({
      status: 'ended',
      createdAt: { $lt: twoDaysAgo }
    });

    if (!oldSessions || oldSessions.length === 0) {
      logger.info('No old QuizWave sessions to clean up');
      return { deletedCount: 0, deletedResponses: 0 };
    }

    const sessionIds = oldSessions
      .map(s => s && s._id ? s._id : null)
      .filter(id => id !== null);

    // Delete related responses
    let deletedResponses = 0;
    if (sessionIds.length > 0) {
      try {
        const responseResult = await QuizResponse.deleteMany({ session: { $in: sessionIds } });
        deletedResponses = responseResult.deletedCount || 0;
      } catch (responseError) {
        logger.warn('Error deleting QuizWave responses', { error: responseError.message });
      }
    }

    // Delete old sessions
    const result = await QuizSession.deleteMany({
      status: 'ended',
      createdAt: { $lt: twoDaysAgo }
    });

    const deletedCount = result.deletedCount || 0;

    logger.info('QuizWave cleanup completed', {
      deletedSessions: deletedCount,
      deletedResponses: deletedResponses
    });

    return { deletedCount, deletedResponses };
  } catch (error) {
    logger.error('Error during QuizWave cleanup', { error: error.message, stack: error.stack });
    throw error;
  }
};

/**
 * Start the cleanup scheduler
 * Runs cleanup every 24 hours
 */
const startCleanupScheduler = () => {
  // Run cleanup immediately on startup (optional)
  cleanupOldSessions().catch(err => {
    logger.error('Error during initial QuizWave cleanup', { error: err.message });
  });

  // Schedule cleanup to run every 24 hours
  const interval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  setInterval(() => {
    cleanupOldSessions().catch(err => {
      logger.error('Error during scheduled QuizWave cleanup', { error: err.message });
    });
  }, interval);

  logger.info('QuizWave cleanup scheduler started (runs every 24 hours)');
};

module.exports = {
  cleanupOldSessions,
  startCleanupScheduler
};

