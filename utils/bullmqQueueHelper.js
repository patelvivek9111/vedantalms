const { Queue, Worker } = require('bullmq');
const { isRedisConfigured, getBullmqConnection } = require('./bullmqConnection');

function shouldRunInlineQueues() {
  return !isRedisConfigured() || process.env.FORCE_INLINE_JOBS === 'true';
}

/**
 * Lightweight factory for dedicated BullMQ queues (notifications, files, quizwave timers).
 */
function createQueueService({ queueName, defaultJobOptions = {} }) {
  let queue = null;
  let worker = null;

  function getQueue() {
    if (shouldRunInlineQueues()) return null;
    if (queue) return queue;
    const connection = getBullmqConnection();
    if (!connection) return null;
    queue = new Queue(queueName, { connection, defaultJobOptions });
    queue.on('error', (err) => {
      console.error(`${queueName} queue error`, err?.message || err);
    });
    return queue;
  }

  async function addJob(jobName, data, opts = {}) {
    const q = getQueue();
    if (!q) return null;
    return q.add(jobName, data, opts);
  }

  async function removeJob(jobId) {
    const q = getQueue();
    if (!q || !jobId) return false;
    try {
      const job = await q.getJob(jobId);
      if (job) {
        await job.remove();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function startWorker(processor, { concurrency = 2 } = {}) {
    if (shouldRunInlineQueues() || worker) return null;
    const connection = getBullmqConnection();
    if (!connection) return null;

    worker = new Worker(queueName, processor, { connection, concurrency });
    worker.on('failed', (job, err) => {
      console.error(`${queueName} worker job failed`, job?.id, err?.message);
    });
    worker.on('error', (err) => {
      console.error(`${queueName} worker error`, err?.message || err);
    });
    return worker;
  }

  return {
    queueName,
    getQueue,
    addJob,
    removeJob,
    startWorker,
    shouldRunInline: shouldRunInlineQueues,
  };
}

module.exports = {
  createQueueService,
  shouldRunInlineQueues,
};
