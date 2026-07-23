/**
 * Wave D: async job queue (inline fallback in test).
 */
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const { applyJestExportPaths } = require('../exportPaths');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const User = require('../../models/user.model');
const AsyncJob = require('../../models/asyncJob.model');
const jobQueueService = require('../../services/jobQueue.service');

describe('jobQueue (Wave D)', () => {
  let mongoServer;
  let contract;
  let registrar;
  let previousMongoUri;

  beforeAll(async () => {
    applyJestExportPaths();
    process.env.FORCE_INLINE_JOBS = 'true';
    previousMongoUri = process.env.MONGODB_URI;
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    contract = await seedGradingContractE2E();
    registrar = await User.create({
      firstName: 'Reg',
      lastName: 'Worker',
      email: `reg.worker.${Date.now()}@example.com`,
      password: 'password123',
      role: 'registrar',
      rootAccountId: contract.rootAccountId,
      accountId: contract.rootAccountId,
    });
  }, 120000);

  afterAll(async () => {
    delete process.env.FORCE_INLINE_JOBS;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
    const fs = require('fs');
    const path = require('path');
    const sharedUriFile = path.join(__dirname, '../.mongo-memory-uri');
    if (fs.existsSync(sharedUriFile)) {
      process.env.MONGODB_URI = fs.readFileSync(sharedUriFile, 'utf8').trim();
    } else if (previousMongoUri) {
      process.env.MONGODB_URI = previousMongoUri;
    }
  });

  it('runs grades.finalize inline and marks job completed', async () => {
    const gradeLifecycleService = require('../../services/gradeLifecycle.service');
    await gradeLifecycleService.transitionToPosted(contract.courseId, {
      _id: contract.teacherId,
      role: 'teacher',
      rootAccountId: contract.rootAccountId,
    });

    const { job, async: isAsync } = await jobQueueService.enqueueJob(
      'grades.finalize',
      { courseId: contract.courseId, userId: String(registrar._id), rootAccountId: contract.rootAccountId },
      registrar
    );

    expect(isAsync).toBe(false);
    expect(job.status).toBe('completed');
    expect(job.result?.frozenCount).toBeGreaterThanOrEqual(1);
  });

  it('runs export.gradebook inline with download token', async () => {
    const { job } = await jobQueueService.enqueueJob(
      'export.gradebook',
      { courseId: contract.courseId, rootAccountId: contract.rootAccountId },
      registrar
    );

    expect(job.status).toBe('completed');
    expect(job.filePath).toBeTruthy();
    expect(job.filePath.startsWith(process.env.JOB_EXPORTS_DIR)).toBe(true);
    expect(job.downloadToken).toBeTruthy();
    expect(job.result?.studentCount).toBeGreaterThanOrEqual(1);
  });

  it('paginates gradebook API dataset', async () => {
    const { getCourseGradebookPage } = require('../../services/gradebookData.service');
    const page = await getCourseGradebookPage(contract.courseId, { page: 1, pageSize: 1 });
    expect(page.pagination.totalStudents).toBeGreaterThanOrEqual(1);
    expect(page.students.length).toBeLessThanOrEqual(1);
    expect(page.policyMeta.policyHash).toBeTruthy();
  });
});
