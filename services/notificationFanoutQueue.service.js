const {
  fanoutBoundedDomainNotifications,
  fanoutAcademicDomainNotifications,
} = require('./notification/academicNotificationExpansion.service');
const { buildFanoutContextFromPayload } = require('./notificationFanoutJobHandlers');
const { createQueueService } = require('../utils/bullmqQueueHelper');

const QUEUE_NAME = 'notifications';
const JOB_NAME = 'notifications.academic_fanout';
const queueService = createQueueService({ queueName: QUEUE_NAME });

function shouldUseNotificationFanoutQueue() {
  if (process.env.NOTIFICATION_FANOUT_QUEUE_ENABLED === 'false') return false;
  return !queueService.shouldRunInline();
}

async function processAcademicFanoutJob(payload = {}) {
  const {
    handler,
    domainEvent,
    recipientIds = [],
    actorId = null,
    relatedId = null,
    relatedType = null,
    requestId = null,
    context = {},
    bounded = true,
  } = payload;

  const buildContextForRecipient = buildFanoutContextFromPayload(handler, context);
  const fanoutFn = bounded ? fanoutBoundedDomainNotifications : fanoutAcademicDomainNotifications;

  return fanoutFn({
    domainEvent,
    recipientIds,
    actorId,
    relatedId,
    relatedType,
    requestId,
    buildContextForRecipient,
  });
}

async function enqueueAcademicFanout(payload) {
  if (!shouldUseNotificationFanoutQueue()) {
    const result = await processAcademicFanoutJob(payload);
    return { ...result, queued: false };
  }

  const attempts = parseInt(process.env.NOTIFICATION_FANOUT_MAX_ATTEMPTS || '3', 10);
  const job = await queueService.addJob(JOB_NAME, payload, {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts,
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.JOB_BACKOFF_MS || '2000', 10),
    },
  });

  return { queued: true, jobId: job?.id || null, delivered: 0, skipped: 0, suppressed: 0, failed: 0 };
}

function startNotificationFanoutWorker() {
  return queueService.startWorker(
    async (job) => {
      if (job.name !== JOB_NAME) {
        throw new Error(`Unknown notification job: ${job.name}`);
      }
      return processAcademicFanoutJob(job.data);
    },
    {
      concurrency: parseInt(process.env.NOTIFICATION_FANOUT_WORKER_CONCURRENCY || '2', 10),
    }
  );
}

module.exports = {
  JOB_NAME,
  shouldUseNotificationFanoutQueue,
  enqueueAcademicFanout,
  processAcademicFanoutJob,
  startNotificationFanoutWorker,
};
