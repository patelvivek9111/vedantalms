const { runScan } = require('./fileScan.service');
const { createQueueService } = require('../utils/bullmqQueueHelper');

const QUEUE_NAME = 'files';
const JOB_NAME = 'files.scan';
const queueService = createQueueService({ queueName: QUEUE_NAME });

function shouldUseFileScanQueue() {
  if (process.env.FILE_SCAN_QUEUE_ENABLED === 'false') return false;
  return !queueService.shouldRunInline();
}

async function enqueueFileScan(fileAssetId, audit = {}) {
  const id = String(fileAssetId);

  if (!shouldUseFileScanQueue()) {
    setImmediate(() => {
      runScan(id, audit).catch((err) => {
        console.error('[fileScan] inline scan failed', id, err.message);
      });
    });
    return { queued: false, fileAssetId: id };
  }

  const attempts = parseInt(process.env.FILE_SCAN_MAX_ATTEMPTS || '3', 10);
  const job = await queueService.addJob(
    JOB_NAME,
    { fileAssetId: id, audit },
    {
      jobId: `files.scan:${id}`,
      removeOnComplete: 500,
      removeOnFail: 100,
      attempts,
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.JOB_BACKOFF_MS || '2000', 10),
      },
    }
  );

  return { queued: true, jobId: job?.id || null, fileAssetId: id };
}

function startFileScanWorker() {
  return queueService.startWorker(
    async (job) => {
      if (job.name !== JOB_NAME) {
        throw new Error(`Unknown file job: ${job.name}`);
      }
      const { fileAssetId, audit = {} } = job.data || {};
      if (!fileAssetId) throw new Error('files.scan missing fileAssetId');
      return runScan(fileAssetId, audit);
    },
    {
      concurrency: parseInt(process.env.FILE_SCAN_WORKER_CONCURRENCY || '3', 10),
    }
  );
}

module.exports = {
  JOB_NAME,
  shouldUseFileScanQueue,
  enqueueFileScan,
  startFileScanWorker,
};
