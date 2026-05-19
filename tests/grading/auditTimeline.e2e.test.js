/**
 * Wave E: HTTP provenance + audit-timeline endpoints.
 */
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const User = require('../../models/user.model');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/grades', require('../../routes/grades.routes'));
  return app;
}

describe('audit timeline E2E (Wave E)', () => {
  let mongoServer;
  let app;
  let contract;
  let teacherToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.DISABLE_RATE_LIMIT = 'true';
    await mongoose.connect(process.env.MONGODB_URI);
    app = createApp();
    contract = await seedGradingContractE2E();
    teacherToken = contract.teacherToken;
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('GET provenance returns policy chain', async () => {
    const res = await request(app)
      .get(`/api/grades/course/${contract.courseId}/provenance`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.policyChain.resolved.hash).toBeTruthy();
    expect(res.body.data.gradingEngineVersion).toBeTruthy();
  });

  it('GET audit-timeline returns sorted entries', async () => {
    const res = await request(app)
      .get(`/api/grades/course/${contract.courseId}/audit-timeline`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('student cannot access provenance', async () => {
    const res = await request(app)
      .get(`/api/grades/course/${contract.courseId}/provenance`)
      .set('Authorization', `Bearer ${contract.studentToken}`);
    expect(res.status).toBe(403);
  });
});
