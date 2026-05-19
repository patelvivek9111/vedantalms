const { Queue, Worker } = require('bullmq');
const AsyncJob = require('../models/asyncJob.model');
const { isRedisConfigured, getBullmqConnection } = require('../utils/bullmqConnection');
const { runJobByType } = require('./gradingJobProcessors');

const QUEUE_NAME = 'grading';
let queue = null;
let worker = null;

function shouldRunInline() {
  return !isRedisConfigured() || process.env.FORCE_INLINE_JOBS === 'true';
}

function getGradingQueue() {
  if (shouldRunInline()) return null;
  if (queue) return queue;
  const connection = getBullmqConnection();
  if (!connection) return null;
  queue = new Queue(QUEUE_NAME, { connection });
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
  if (shouldRunInline() || worker) return null;
  const connection = getBullmqConnection();
  if (!connection) return null;

  worker = new Worker(
    QUEUE_NAME,
    async (bullJob) => {
      const jobId = bullJob.data?.jobId || bullJob.id;
      const jobDoc = await AsyncJob.findById(jobId);
      if (!jobDoc) throw new Error(`AsyncJob ${jobId} not found`);
      return executeJob(jobDoc);
    },
    { connection, concurrency: parseInt(process.env.GRADING_WORKER_CONCURRENCY || '2', 10) }
  );

  worker.on('failed', (bullJob, err) => {
    console.error('grading worker job failed', bullJob?.id, err?.message);
  });

  return worker;
}

function getAsyncStudentThreshold() {
  return parseInt(process.env.GRADING_ASYNC_STUDENT_THRESHOLD || '50', 10);
}

function shouldUseAsyncJob(studentCount) {
  return studentCount >= getAsyncStudentThreshold();
}

module.exports = {
  enqueueJob,
  getJobForUser,
  startGradingWorker,
  shouldRunInline,
  shouldUseAsyncJob,
  getAsyncStudentThreshold,
  executeJob,
};
