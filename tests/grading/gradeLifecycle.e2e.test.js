/**
 * Wave A: DRAFT → POSTED → FINALIZED lifecycle + immutability guards.
 */
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const User = require('../../models/user.model');
const CourseGradingPolicy = require('../../models/courseGradingPolicy.model');
const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');
const Submission = require('../../models/Submission');
const gradingPolicyService = require('../../services/gradingPolicy.service');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/grades', require('../../routes/grades.routes'));
  app.use('/api/reports', require('../../routes/reports.routes'));
  app.use('/api/grading-policy', require('../../routes/gradingPolicy.routes'));
  app.use('/api/submissions', require('../../routes/submission.routes'));
  return app;
}

describe('grade lifecycle E2E (Wave A)', () => {
  let mongoServer;
  let app;
  let contract;
  let adminToken;
  let gradedSubmissionId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
    app = createApp();
    contract = await seedGradingContractE2E();

    const admin = await User.create({
      firstName: 'Registrar',
      lastName: 'Admin',
      email: `registrar.${Date.now()}@example.com`,
      password: 'password123',
      role: 'admin',
    });
    adminToken = admin.getSignedJwtToken();

    const sub = await Submission.findOne({ student: contract.studentId });
    gradedSubmissionId = sub._id.toString();
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  it('DRAFT → POSTED → FINALIZED with batch freeze', async () => {
    const lifecycleRes = await request(app)
      .get(`/api/grades/course/${contract.courseId}/lifecycle`)
      .set('Authorization', `Bearer ${contract.teacherToken}`);
    expect(lifecycleRes.status).toBe(200);
    expect(lifecycleRes.body.data.lifecycle.status).toBe('DRAFT');

    const postRes = await request(app)
      .post(`/api/grades/course/${contract.courseId}/post`)
      .set('Authorization', `Bearer ${contract.teacherToken}`);
    expect(postRes.status).toBe(200);
    expect(postRes.body.data.status).toBe('POSTED');

    const finalizeRes = await request(app)
      .post(`/api/grades/course/${contract.courseId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.data.lifecycle.status).toBe('FINALIZED');
    expect(finalizeRes.body.data.frozenCount).toBeGreaterThanOrEqual(1);
    expect(finalizeRes.body.data.gradingEngineVersion).toMatch(/^\d+\.\d+\.\d+$/);

    const lifecycleFinal = await CourseGradeLifecycle.findOne({
      course: contract.courseId,
      term: 'Spring',
      year: 2025,
    });
    expect(lifecycleFinal.status).toBe('FINALIZED');
    expect(lifecycleFinal.policyHash).toBeTruthy();
  });

  it('institution policy change does not alter finalized transcript', async () => {
    const first = await request(app)
      .get('/api/reports/transcript?term=Spring&year=2025')
      .set('Authorization', `Bearer ${contract.studentToken}`);
    expect(first.status).toBe(200);
    const frozenPercent = first.body.data.courses.find((c) => c.courseId === contract.courseId)
      .finalGrade;

    const inst = await gradingPolicyService.getInstitutionPolicyDocument();
    await gradingPolicyService.updateInstitutionPolicy(
      {
        ...inst.policy,
        latePenalty: { ...inst.policy.latePenalty, enabled: true, perDayPercent: 99 },
      },
      contract.teacherId
    );

    const second = await request(app)
      .get('/api/reports/transcript?term=Spring&year=2025')
      .set('Authorization', `Bearer ${contract.studentToken}`);
    const row2 = second.body.data.courses.find((c) => c.courseId === contract.courseId);
    expect(row2.finalGrade).toBeCloseTo(frozenPercent, 4);
    expect(row2.fromFrozenSnapshot).toBe(true);
    expect(row2.lifecycleStatus).toBe('FINALIZED');
  });

  it('blocks submission grading and course policy changes after finalize', async () => {
    const gradeRes = await request(app)
      .put(`/api/submissions/${gradedSubmissionId}`)
      .set('Authorization', `Bearer ${contract.teacherToken}`)
      .send({ grade: 50 });
    expect(gradeRes.status).toBe(403);

    const policyRes = await request(app)
      .put(`/api/grading-policy/course/${contract.courseId}`)
      .set('Authorization', `Bearer ${contract.teacherToken}`)
      .send({
        policy: {
          missingAssignment: { mode: 'exclude_until_graded' },
        },
      });
    expect(policyRes.status).toBe(403);
  });
});
