/**
 * Wave C: transcript recompute dry-run / apply + issuance.
 */
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const User = require('../../models/user.model');
const Submission = require('../../models/Submission');
const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
const SystemAuditEvent = require('../../models/systemAuditEvent.model');
const TranscriptIssueLog = require('../../models/transcriptIssueLog.model');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/grades', require('../../routes/grades.routes'));
  app.use('/api/grading-policy', require('../../routes/gradingPolicy.routes'));
  app.use('/api/reports', require('../../routes/reports.routes'));
  return app;
}

describe('transcript recompute E2E (Wave C)', () => {
  let mongoServer;
  let app;
  let contract;
  let registrarToken;
  let teacherToken;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';
    process.env.DISABLE_RATE_LIMIT = 'true';
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
    app = createApp();
    contract = await seedGradingContractE2E();
    teacherToken = contract.teacherToken;

    const registrar = await User.create({
      firstName: 'Reg',
      lastName: 'Istrar',
      email: `registrar.c.${Date.now()}@example.com`,
      password: 'password123',
      role: 'registrar',
    });
    registrarToken = registrar.getSignedJwtToken();
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  it('dry-run shows diff without mutating frozen snapshots', async () => {
    await request(app)
      .post(`/api/grades/course/${contract.courseId}/post`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    await request(app)
      .post(`/api/grades/course/${contract.courseId}/finalize`)
      .set('Authorization', `Bearer ${registrarToken}`)
      .expect(200);

    const beforeCount = await StudentCourseGradeSnapshot.countDocuments({
      course: contract.courseId,
      student: contract.studentId,
    });

    const dry = await request(app)
      .post('/api/grading-policy/transcript/recompute')
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({
        courseId: contract.courseId,
        term: 'Spring',
        year: 2025,
        dryRun: true,
      });

    expect(dry.status).toBe(200);
    expect(dry.body.data.dryRun).toBe(true);
    expect(Array.isArray(dry.body.data.affected)).toBe(true);
    expect(dry.body.data.affected.length).toBeGreaterThanOrEqual(1);

    const afterCount = await StudentCourseGradeSnapshot.countDocuments({
      course: contract.courseId,
      student: contract.studentId,
    });
    expect(afterCount).toBe(beforeCount);
  });

  it('apply on finalized without forceAmend returns 403', async () => {
    const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');
    const life = await CourseGradeLifecycle.findOne({
      course: contract.courseId,
      term: 'Spring',
      year: 2025,
    }).lean();
    if (!life || !['FINALIZED', 'AMENDED'].includes(life.status)) {
      await request(app)
        .post(`/api/grades/course/${contract.courseId}/post`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
      await request(app)
        .post(`/api/grades/course/${contract.courseId}/finalize`)
        .set('Authorization', `Bearer ${registrarToken}`)
        .expect(200);
    }

    const res = await request(app)
      .post('/api/grading-policy/transcript/recompute')
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({
        courseId: contract.courseId,
        term: 'Spring',
        year: 2025,
        dryRun: false,
        reason: 'Attempt apply without amend',
      });

    expect(res.status).toBe(403);
  });

  it('apply without reason returns 400', async () => {
    const res = await request(app)
      .post('/api/grading-policy/transcript/recompute')
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({
        courseId: contract.courseId,
        dryRun: false,
        forceAmend: true,
      });

    expect(res.status).toBe(400);
  });

  it('teacher cannot recompute', async () => {
    const res = await request(app)
      .post('/api/grading-policy/transcript/recompute')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ courseId: contract.courseId, dryRun: true });

    expect(res.status).toBe(403);
  });

  it('apply with forceAmend requires reason and creates audit', async () => {
    const beforeSnaps = await StudentCourseGradeSnapshot.countDocuments({
      course: contract.courseId,
      student: contract.studentId,
    });

    const apply = await request(app)
      .post('/api/grading-policy/transcript/recompute')
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({
        courseId: contract.courseId,
        term: 'Spring',
        year: 2025,
        dryRun: false,
        forceAmend: true,
        reason: 'Registrar correction after grade entry review',
      });

    expect(apply.status).toBe(200);
    expect(apply.body.data.applied).toBe(true);
    expect(apply.body.data.via).toBe('forceAmend');

    const afterSnaps = await StudentCourseGradeSnapshot.countDocuments({
      course: contract.courseId,
      student: contract.studentId,
    });
    expect(afterSnaps).toBeGreaterThan(beforeSnaps);

    const audit = await SystemAuditEvent.findOne({ action: 'transcript_recompute_applied' });
    expect(audit).toBeTruthy();
  });

  it('issues official transcript with stable hash', async () => {
    await request(app)
      .get('/api/reports/transcript?term=Spring&year=2025')
      .set('Authorization', `Bearer ${contract.studentToken}`)
      .expect(200);

    const issue = await request(app)
      .post('/api/reports/transcript/issue')
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({
        studentId: contract.studentId,
        term: 'Spring',
        year: 2025,
        notes: 'Official copy for records',
      });

    expect(issue.status).toBe(201);
    expect(issue.body.data.transcriptHash).toMatch(/^[a-f0-9]{64}$/);

    const log = await TranscriptIssueLog.findOne({ student: contract.studentId });
    expect(log).toBeTruthy();
    expect(log.transcriptHash).toBe(issue.body.data.transcriptHash);
  });

  it('dry-run detects change when submission grade updated on posted course', async () => {
    const course2 = await seedGradingContractE2E();
    await request(app)
      .post(`/api/grades/course/${course2.courseId}/post`)
      .set('Authorization', `Bearer ${course2.teacherToken}`)
      .expect(200);

    const sub = await Submission.findOne({
      student: course2.studentId,
      assignment: course2.assignmentIds.graded,
    });
    if (sub) {
      sub.grade = Math.max(0, (sub.grade || 50) - 10);
      await sub.save();
    }

    const dry = await request(app)
      .post('/api/grading-policy/transcript/recompute')
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({
        courseId: course2.courseId,
        term: 'Spring',
        year: 2025,
        dryRun: true,
      });

    expect(dry.status).toBe(200);
    const row = dry.body.data.affected.find((r) => r.studentId === String(course2.studentId));
    expect(row).toBeTruthy();
  });
});
