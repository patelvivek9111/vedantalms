/**
 * BullMQ job queue adapter — delegates to existing jobQueue.service (no behavior change).
 */
const jobQueue = require('../../services/jobQueue.service');

class BullMQAdapter {
  constructor() {
    this.name = 'bullmq';
  }

  enqueue(type, payload, requestedBy) {
    return jobQueue.enqueueJob(type, payload, requestedBy);
  }

  getJob(jobId, userId) {
    return jobQueue.getJobForUser(jobId, userId);
  }

  startWorker() {
    return jobQueue.startGradingWorker();
  }

  shouldRunInline() {
    return jobQueue.shouldRunInline();
  }

  shouldUseAsync(studentCount) {
    return jobQueue.shouldUseAsyncJob(studentCount);
  }

  getAsyncThreshold() {
    return jobQueue.getAsyncStudentThreshold();
  }

  getCapabilities() {
    return {
      supportsRetries: true,
      supportsDeadLetter: false,
      supportsDelayedJobs: true,
    };
  }
}

module.exports = { BullMQAdapter };
