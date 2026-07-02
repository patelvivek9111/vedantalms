const { Queue, Worker } = require('bullmq');
const AsyncJob = require('../models/asyncJob.model');
const { isRedisConfigured, getBullmqConnection } = require('../utils/bullmqConnection');
const { runJobByType } = require('./gradingJobProcessors');

const QUEUE_NAME = 'grading';
let queue = null;
let worker = null;
let embeddedWorkerStarted = false;
let workerHeartbeatAt = null;

function touchWorkerHeartbeat() {
  workerHeartbeatAt = new Date().toISOString();
}

function getWorkerStatus() {
  if (shouldRunInline()) {
    return { mode: 'inline', running: true, heartbeatAt: workerHeartbeatAt };
  }
  if (embeddedWorkerStarted && worker) {
    return { mode: 'embedded', running: true, heartbeatAt: workerHeartbeatAt };
  }
  if (process.env.GRADING_WORKER_HEARTBEAT_AT) {
    return {
      mode: 'external',
      running: true,
      heartbeatAt: process.env.GRADING_WORKER_HEARTBEAT_AT,
    };
  }
  return { mode: 'queue', running: false, heartbeatAt: workerHeartbeatAt };
}

function shouldRunInline() {
  return !isRedisConfigured() || process.env.FORCE_INLINE_JOBS === 'true';
}

function getGradingQueue() {
  if (shouldRunInline()) return null;
  if (queue) return queue;
  const connection = getBullmqConnection();
  if (!connection) return null;
  queue = new Queue(QUEUE_NAME, { connection });
  queue.on('error', (err) => {
    console.error('grading queue error', err?.message || err);
  });
  return queue;
}

async function executeJob(jobDoc) {
  await AsyncJob.findByIdAndUpdate(jobDoc._id, { status: 'active' });
  try {
    const result = await runJobByType(jobDoc);
    const updated = await AsyncJob.findByIdAndUpdate(
      jobDoc._id,
      { status: 'completed', result },
      { new: true }
    ).lean();
    return updated;
  } catch (error) {
    await AsyncJob.findByIdAndUpdate(jobDoc._id, {
      status: 'failed',
      error: error.message || String(error),
      failedAt: new Date(),
    });
    const academicAuditService = require('./academicAudit.service');
    await academicAuditService
      .recordAuditEvent({
        actorId: jobDoc.requestedBy,
        entityType: 'async_job',
        entityId: String(jobDoc._id),
        action: 'job_failed',
        severity: 'critical',
        metadata: { type: jobDoc.type, error: error.message },
      })
      .catch(() => {});
    throw error;
  }
}

async function runInline(jobDoc) {
  return executeJob(jobDoc);
}

async function enqueueJob(type, payload, requestedBy) {
  const jobDoc = await AsyncJob.create({
    type,
    payload,
    requestedBy: requestedBy._id || requestedBy,
    status: 'pending',
  });

  if (shouldRunInline()) {
    const completed = await runInline(jobDoc);
    return { job: completed, async: false };
  }

  const q = getGradingQueue();
  if (!q) {
    const completed = await runInline(jobDoc);
    return { job: completed, async: false };
  }

  const attempts = parseInt(process.env.JOB_MAX_ATTEMPTS || '3', 10);
  try {
    const bullJob = await q.add(
      type,
      { jobId: String(jobDoc._id) },
      {
        jobId: String(jobDoc._id),
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts,
        backoff: { type: 'exponential', delay: parseInt(process.env.JOB_BACKOFF_MS || '2000', 10) },
      }
    );

    await AsyncJob.findByIdAndUpdate(jobDoc._id, { bullJobId: String(bullJob.id) });
    const fresh = await AsyncJob.findById(jobDoc._id).lean();
    return { job: fresh, async: true };
  } catch {
    const completed = await runInline(jobDoc);
    return { job: completed, async: false };
  }
}

async function requeueExistingJob(jobId) {
  const jobDoc = await AsyncJob.findById(jobId);
  if (!jobDoc) {
    const err = new Error('Job not found');
    err.statusCode = 404;
    throw err;
  }
  if (!['pending', 'failed'].includes(jobDoc.status)) {
    const err = new Error('Only pending or failed jobs can be retried');
    err.statusCode = 400;
    throw err;
  }

  const fresh = await AsyncJob.findByIdAndUpdate(
    jobId,
    { status: 'pending', error: undefined, failedAt: undefined },
    { new: true }
  );

  if (shouldRunInline()) {
    const completed = await runInline(fresh);
    return { job: completed, async: false };
  }

  const q = getGradingQueue();
  if (!q) {
    const completed = await runInline(fresh);
    return { job: completed, async: false };
  }

  const attempts = parseInt(process.env.JOB_MAX_ATTEMPTS || '3', 10);
  const bullJob = await q.add(
    fresh.type,
    { jobId: String(fresh._id) },
    {
      jobId: `requeue-${fresh._id}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts,
      backoff: { type: 'exponential', delay: parseInt(process.env.JOB_BACKOFF_MS || '2000', 10) },
    }
  );
  await AsyncJob.findByIdAndUpdate(fresh._id, { bullJobId: String(bullJob.id) });
  const updated = await AsyncJob.findById(fresh._id).lean();
  return { job: updated, async: true };
}

async function dismissJob(jobId) {
  const job = await AsyncJob.findById(jobId);
  if (!job) {
    const err = new Error('Job not found');
    err.statusCode = 404;
    throw err;
  }
  if (!['pending', 'failed'].includes(job.status)) {
    const err = new Error('Only pending or failed jobs can be dismissed');
    err.statusCode = 400;
    throw err;
  }
  await AsyncJob.findByIdAndDelete(jobId);
  return { dismissed: true };
}

async function reconcilePendingJobs() {
  if (shouldRunInline()) return { reconciled: 0 };
  const q = getGradingQueue();
  if (!q) return { reconciled: 0 };

  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  const stuck = await AsyncJob.find({
    status: 'pending',
    createdAt: { $lt: cutoff },
  })
    .sort({ createdAt: 1 })
    .limit(25)
    .lean();

  let reconciled = 0;
  const attempts = parseInt(process.env.JOB_MAX_ATTEMPTS || '3', 10);
  for (const job of stuck) {
    try {
      const bullJob = await q.add(
        job.type,
        { jobId: String(job._id) },
        {
          jobId: `reconcile-${job._id}-${Date.now()}`,
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts,
          backoff: { type: 'exponential', delay: parseInt(process.env.JOB_BACKOFF_MS || '2000', 10) },
        }
      );
      await AsyncJob.findByIdAndUpdate(job._id, { bullJobId: String(bullJob.id) });
      reconciled += 1;
    } catch (err) {
      console.error('reconcile pending job failed', job._id, err?.message || err);
    }
  }
  return { reconciled };
}

async function closeGradingWorker() {
  if (!worker) return;
  await worker.close();
  worker = null;
  embeddedWorkerStarted = false;
}

async function getJobForUser(jobId, userId) {
  const job = await AsyncJob.findById(jobId).lean();
  if (!job) return null;
  if (String(job.requestedBy) !== String(userId)) {
    const User = require('../models/user.model');
    const user = await User.findById(userId).select('role').lean();
    if (!user || !['admin', 'registrar', 'department_admin'].includes(user.role)) {
      return null;
    }
  }
  return job;
}

function startGradingWorker() {
  if (shouldRunInline() || worker) return worker;
  const connection = getBullmqConnection();
  if (!connection) return null;

  worker = new Worker(
    QUEUE_NAME,
    async (bullJob) => {
      touchWorkerHeartbeat();
      const jobId = bullJob.data?.jobId || bullJob.id;
      const jobDoc = await AsyncJob.findById(jobId);
      if (!jobDoc) throw new Error(`AsyncJob ${jobId} not found`);
      return executeJob(jobDoc);
    },
    { connection, concurrency: parseInt(process.env.GRADING_WORKER_CONCURRENCY || '2', 10) }
  );

  worker.on('completed', () => touchWorkerHeartbeat());
  worker.on('failed', (bullJob, err) => {
    touchWorkerHeartbeat();
    console.error('grading worker job failed', bullJob?.id, err?.message);
  });
  worker.on('error', (err) => {
    console.error('grading worker error', err?.message || err);
  });

  touchWorkerHeartbeat();
  return worker;
}

function startEmbeddedGradingWorkerIfNeeded() {
  if (process.env.DISABLE_EMBEDDED_JOB_WORKER === 'true') return null;
  if (shouldRunInline()) return null;
  const started = startGradingWorker();
  if (started) {
    embeddedWorkerStarted = true;
    void reconcilePendingJobs()
      .then((r) => {
        if (r.reconciled > 0) {
          console.log(`Re-queued ${r.reconciled} stuck background job(s)`);
        }
      })
      .catch((err) => console.error('reconcilePendingJobs failed', err?.message || err));
  }
  return started;
}

function getAsyncStudentThreshold() {
  return parseInt(process.env.GRADING_ASYNC_STUDENT_THRESHOLD || '50', 10);
}

function shouldUseAsyncJob(studentCount) {
  return studentCount >= getAsyncStudentThreshold();
}

module.exports = {
  enqueueJob,
  requeueExistingJob,
  dismissJob,
  reconcilePendingJobs,
  getJobForUser,
  startGradingWorker,
  startEmbeddedGradingWorkerIfNeeded,
  closeGradingWorker,
  getWorkerStatus,
  shouldRunInline,
  shouldUseAsyncJob,
  getAsyncStudentThreshold,
  executeJob,
};
