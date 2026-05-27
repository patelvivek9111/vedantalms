const Submission = require('../models/Submission');
const timedQuizAttemptService = require('./timedQuizAttempt.service');
const observability = require('./workflowObservability.service');

async function recoverStuckTimedQuizAttempts({ now = new Date(), staleMinutes = 15, limit = 500, apply = false } = {}) {
  const staleBefore = new Date(now.getTime() - Number(staleMinutes) * 60 * 1000);
  const candidates = await Submission.find({
    attemptStatus: 'in_progress',
    $or: [
      { attemptDeadlineAt: { $lte: now } },
      { lastHeartbeatAt: { $lte: staleBefore }, attemptDeadlineAt: { $lte: now } },
    ],
  })
    .sort({ attemptDeadlineAt: 1, _id: 1 })
    .limit(limit);

  if (!apply) {
    return {
      apply,
      candidateCount: candidates.length,
      candidates: candidates.map((submission) => ({
        submissionId: String(submission._id),
        assignmentId: String(submission.assignment),
        attemptDeadlineAt: submission.attemptDeadlineAt,
        lastHeartbeatAt: submission.lastHeartbeatAt,
      })),
    };
  }

  const result = await timedQuizAttemptService.sweepExpiredTimedQuizAttempts({ limit, now });
  observability.emitWorkflowEvent('quiz_recovery_completed', result);
  return { apply, ...result };
}

module.exports = {
  recoverStuckTimedQuizAttempts,
};
