const { createQueueService } = require('../utils/bullmqQueueHelper');

const QUEUE_NAME = 'quizwave-timers';
const JOB_NAME = 'quizwave.phase_transition';
const queueService = createQueueService({ queueName: QUEUE_NAME });

function shouldUseDistributedQuizwaveTimers() {
  if (process.env.QUIZWAVE_DISTRIBUTED_TIMERS === 'false') return false;
  return !queueService.shouldRunInline();
}

function buildJobId(gamePin, currentPhase) {
  return `quizwave:${gamePin}:${currentPhase}`;
}

async function enqueueQuizwavePhaseTransition({ sessionId, gamePin, currentPhase, delayMs }) {
  if (!shouldUseDistributedQuizwaveTimers()) return null;

  const safeDelay = Math.max(0, Number(delayMs) || 0);
  const jobId = buildJobId(gamePin, currentPhase);

  await queueService.removeJob(jobId);

  return queueService.addJob(
    JOB_NAME,
    { sessionId: String(sessionId), gamePin, currentPhase },
    {
      jobId,
      delay: safeDelay,
      removeOnComplete: 50,
      removeOnFail: 25,
      attempts: 2,
    }
  );
}

async function clearQuizwavePhaseJobs(gamePin) {
  if (!shouldUseDistributedQuizwaveTimers()) return;
  const q = queueService.getQueue();
  if (!q) return;

  const phases = [
    'LOBBY',
    'QUESTION_ACTIVE',
    'QUESTION_LOCKED',
    'ANSWER_REVEAL',
    'SCOREBOARD',
    'TRANSITION',
    'FINISHED',
  ];

  await Promise.all(
    phases.map((phase) => queueService.removeJob(buildJobId(gamePin, phase)).catch(() => {}))
  );
}

function startQuizwaveTimerWorker(io) {
  if (!io || !shouldUseDistributedQuizwaveTimers()) return null;

  return queueService.startWorker(
    async (job) => {
      if (job.name !== JOB_NAME) {
        throw new Error(`Unknown quizwave timer job: ${job.name}`);
      }

      const { sessionId, currentPhase } = job.data || {};
      if (!sessionId || !currentPhase) {
        throw new Error('quizwave.phase_transition missing sessionId or currentPhase');
      }

      const { QuizSession } = require('../models/quizwave.model');
      const session = await QuizSession.findById(sessionId).select('phase gamePin').lean();
      if (!session || session.phase !== currentPhase) {
        return { skipped: true, reason: 'phase_mismatch' };
      }

      const engine = require('./quizwaveSessionEngine');
      await engine.runScheduledPhaseTransition(io, sessionId, currentPhase);
      return { ok: true, sessionId, currentPhase };
    },
    {
      concurrency: parseInt(process.env.QUIZWAVE_TIMER_WORKER_CONCURRENCY || '4', 10),
    }
  );
}

module.exports = {
  JOB_NAME,
  shouldUseDistributedQuizwaveTimers,
  enqueueQuizwavePhaseTransition,
  clearQuizwavePhaseJobs,
  startQuizwaveTimerWorker,
};
