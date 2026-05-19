/**
 * Wave B: registrar amend flow + append-only snapshots.
 */
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const User = require('../../models/user.model');
const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
const GradeAmendmentRecord = require('../../models/gradeAmendmentRecord.model');
const SystemAuditEvent = require('../../models/systemAuditEvent.model');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/grades', require('../../routes/grades.routes'));
  app.use('/api/reports', require('../../routes/reports.routes'));
  return app;
}

describe('grade lifecycle amend E2E (Wave B)', () => {
  let mongoServer;
  let app;
  let contract;
  let registrarToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
    app = createApp();
    contract = await seedGradingContractE2E();

    const registrar = await User.create({
      firstName: 'Reg',
      lastName: 'Istrar',
      email: `registrar.b.${Date.now()}@example.com`,
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

  it('registrar finalizes, amends with new snapshots, preserves historical rows', async () => {
    await request(app)
      .post(`/api/grades/course/${contract.courseId}/post`)
      .set('Authorization', `Bearer ${contract.teacherToken}`)
      .expect(200);

    const fin = await request(app)
      .post(`/api/grades/course/${contract.courseId}/finalize`)
      .set('Authorization', `Bearer ${registrarToken}`);
    expect(fin.status).toBe(200);

    const beforeAmend = await request(app)
      .get('/api/reports/transcript?term=Spring&year=2025')
      .set('Authorization', `Bearer ${contract.studentToken}`);
    const percentBefore = beforeAmend.body.data.courses.find(
      (c) => c.courseId === contract.courseId
    ).finalGrade;

    const allBefore = await StudentCourseGradeSnapshot.find({
      course: contract.courseId,
      student: contract.studentId,
    });
    expect(allBefore.length).toBeGreaterThanOrEqual(1);

    const amendRes = await request(app)
      .post(`/api/grades/course/${contract.courseId}/amend`)
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({ reason: 'Correcting input error per registrar review' });
    expect(amendRes.status).toBe(200);
    expect(amendRes.body.data.amendment.sequence).toBe(1);

    const allAfter = await StudentCourseGradeSnapshot.find({
      course: contract.courseId,
      student: contract.studentId,
    });
    expect(allAfter.length).toBeGreaterThan(allBefore.length);

    const current = allAfter.filter((s) => s.isCurrent);
    const superseded = allAfter.filter((s) => !s.isCurrent);
    expect(current.length).toBe(1);
    expect(superseded.length).toBeGreaterThanOrEqual(1);

    const audit = await SystemAuditEvent.findOne({ action: 'grades_amended' });
    expect(audit).toBeTruthy();

    const amendments = await GradeAmendmentRecord.find({ course: contract.courseId });
    expect(amendments.length).toBe(1);
    expect(amendments[0].beforePolicyHash).toBeTruthy();
    expect(amendments[0].afterPolicyHash).toBeTruthy();

    const afterAmend = await request(app)
      .get('/api/reports/transcript?term=Spring&year=2025')
      .set('Authorization', `Bearer ${contract.studentToken}`);
    expect(afterAmend.body.data.courses.find((c) => c.courseId === contract.courseId).finalGrade).toBe(
      afterAmend.body.data.courses.find((c) => c.courseId === contract.courseId).finalGrade
    );
    expect(
      afterAmend.body.data.courses.find((c) => c.courseId === contract.courseId).fromFrozenSnapshot
    ).toBe(true);
  });

  it('teaching assistant cannot post grades', async () => {
    const ta = await User.create({
      firstName: 'TA',
      lastName: 'User',
      email: `ta.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teaching_assistant',
    });
    const Course = require('../../models/course.model');
    await Course.findByIdAndUpdate(contract.courseId, {
      $push: { teachingAssistants: ta._id },
    });

    const res = await request(app)
      .post(`/api/grades/course/${contract.courseId}/post`)
      .set('Authorization', `Bearer ${ta.getSignedJwtToken()}`);
    expect(res.status).toBe(403);
  });
});
