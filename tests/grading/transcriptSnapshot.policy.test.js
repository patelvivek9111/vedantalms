/**
 * Transcript historical reproducibility: policy change must not alter frozen transcript rows.
 */
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const InstitutionGradingPolicy = require('../../models/institutionGradingPolicy.model');
const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
const gradingPolicyService = require('../../services/gradingPolicy.service');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reports', require('../../routes/reports.routes'));
  app.use('/api/grading-policy', require('../../routes/gradingPolicy.routes'));
  return app;
}

describe('transcript policy snapshots', () => {
  let mongoServer;
  let app;
  let contract;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
    app = createApp();
    contract = await seedGradingContractE2E();
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  it('freezes transcript grade on first fetch and survives institution policy change', async () => {
    const first = await request(app)
      .get('/api/reports/transcript?term=Spring&year=2025')
      .set('Authorization', `Bearer ${contract.studentToken}`);

    expect(first.status).toBe(200);
    const row = first.body.data.courses.find((c) => c.courseId === contract.courseId);
    expect(row).toBeDefined();
    const frozenPercent = row.finalGrade;
    const frozenLetter = row.letterGrade;
    expect(row.gradingPolicyHash).toBeTruthy();

    const snap = await StudentCourseGradeSnapshot.findOne({
      student: contract.studentId,
      course: contract.courseId,
      term: 'Spring',
      year: 2025,
    });
    expect(snap).toBeTruthy();
    expect(snap.frozen).toBe(true);

    const inst = await InstitutionGradingPolicy.getPolicy();
    await gradingPolicyService.updateInstitutionPolicy(
      {
        ...inst.policy,
        latePenalty: {
          ...inst.policy.latePenalty,
          enabled: true,
          perDayPercent: 99,
        },
      },
      contract.teacherId
    );

    const second = await request(app)
      .get('/api/reports/transcript?term=Spring&year=2025')
      .set('Authorization', `Bearer ${contract.studentToken}`);

    expect(second.status).toBe(200);
    const row2 = second.body.data.courses.find((c) => c.courseId === contract.courseId);
    expect(row2.finalGrade).toBeCloseTo(frozenPercent, 4);
    expect(row2.letterGrade).toBe(frozenLetter);
    expect(row2.fromFrozenSnapshot).toBe(true);
  });
});
