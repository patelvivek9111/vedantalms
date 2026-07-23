/**
 * Wave D: HTTP job status + async finalize threshold.
 */
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const { applyJestExportPaths } = require('../exportPaths');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const User = require('../../models/user.model');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/grades', require('../../routes/grades.routes'));
  app.use('/api/jobs', require('../../routes/jobs.routes'));
  return app;
}

describe('grading jobs E2E (Wave D)', () => {
  let mongoServer;
  let app;
  let contract;
  let registrarToken;
  let previousMongoUri;

  beforeAll(async () => {
    applyJestExportPaths();
    process.env.FORCE_INLINE_JOBS = 'true';
    process.env.DISABLE_RATE_LIMIT = 'true';
    process.env.GRADING_ASYNC_STUDENT_THRESHOLD = '1';
    previousMongoUri = process.env.MONGODB_URI;
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    app = createApp();
    contract = await seedGradingContractE2E();

    const registrar = await User.create({
      firstName: 'Reg',
      lastName: 'Jobs',
      email: `reg.jobs.${Date.now()}@example.com`,
      password: 'password123',
      role: 'registrar',
      rootAccountId: contract.rootAccountId,
      accountId: contract.rootAccountId,
    });
    registrarToken = registrar.getSignedJwtToken();
  }, 120000);

  afterAll(async () => {
    delete process.env.FORCE_INLINE_JOBS;
    delete process.env.GRADING_ASYNC_STUDENT_THRESHOLD;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
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

  it('finalize returns job payload when async threshold met (inline completion)', async () => {
    await request(app)
      .post(`/api/grades/course/${contract.courseId}/post`)
      .set('Authorization', `Bearer ${contract.teacherToken}`)
      .expect(200);

    const fin = await request(app)
      .post(`/api/grades/course/${contract.courseId}/finalize`)
      .set('Authorization', `Bearer ${registrarToken}`);

    expect([200, 202]).toContain(fin.status);
    expect(fin.body.data.jobId || fin.body.data.lifecycle).toBeTruthy();

    if (fin.body.data.jobId) {
      const jobRes = await request(app)
        .get(`/api/jobs/${fin.body.data.jobId}`)
        .set('Authorization', `Bearer ${registrarToken}`);
      expect(jobRes.status).toBe(200);
      expect(jobRes.body.data.status).toBe('completed');
    }
  });

  it('gradebook export enqueues and exposes download metadata', async () => {
    const exp = await request(app)
      .post(`/api/grades/course/${contract.courseId}/gradebook/export`)
      .set('Authorization', `Bearer ${contract.teacherToken}`);

    expect([200, 202]).toContain(exp.status);
    expect(exp.body.data.jobId).toBeTruthy();
    expect(exp.body.data.status).toBe('completed');
    expect(exp.body.data.downloadUrl).toMatch(/\/api\/jobs\/.+\/download/);
  });

  it('paginated gradebook endpoint returns policy meta', async () => {
    const gb = await request(app)
      .get(`/api/grades/course/${contract.courseId}/gradebook?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${contract.teacherToken}`);

    expect(gb.status).toBe(200);
    expect(gb.body.data.policyMeta.gradingEngineVersion).toBeTruthy();
    expect(gb.body.data.pagination).toBeTruthy();
  });
});
