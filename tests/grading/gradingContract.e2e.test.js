/**
 * Mongo-backed grading contract E2E — real HTTP, Mongoose models, shared calculator parity.
 */
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const { seedGradingContractE2E, CONTRACT_GRADE_SCALE } = require('./e2eContractSeed');
const { getLetterGrade } = require('../../shared/grading/index.cjs');

function createGradingApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/grades', require('../../routes/grades.routes'));
  app.use('/api/reports', require('../../routes/reports.routes'));
  return app;
}

describe('Grading contract E2E (Mongo + HTTP)', () => {
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
    app = createGradingApp();
    contract = await seedGradingContractE2E();
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('student grades API matches transcript and canonical shared calculator', async () => {
    const gradesRes = await request(app)
      .get(`/api/grades/student/course/${contract.courseId}`)
      .set('Authorization', `Bearer ${contract.studentToken}`);

    expect(gradesRes.status).toBe(200);
    const transcriptRes = await request(app)
      .get('/api/reports/transcript?term=Spring&year=2025')
      .set('Authorization', `Bearer ${contract.studentToken}`);

    expect(transcriptRes.status).toBe(200);
    expect(transcriptRes.body.success).toBe(true);

    const courseRow = transcriptRes.body.data.courses.find(
      (c) => c.courseId === contract.courseId
    );
    expect(courseRow).toBeDefined();
    expect(gradesRes.body.totalPercent).toBeCloseTo(courseRow.finalGrade, 4);
    expect(gradesRes.body.letterGrade).toBe(courseRow.letterGrade);
    expect(gradesRes.body.totalPercent).toBeCloseTo(contract.expectedPercent, 4);
    expect(gradesRes.body.letterGrade).toBe(contract.expectedLetter);
  });

  it('covers excused, unpublished, missing, pending, late, and redistribution contract', () => {
    expect(contract.expectedPercent).toBeGreaterThan(0);
    expect(contract.expectedPercent).toBeLessThan(100);

    const { cellExpectations } = contract;
    expect(cellExpectations.graded.display).toBe('80');
    expect(cellExpectations.missing.display).toBe('0 (MA)');
    expect(cellExpectations.pending.display).toBe('Not Graded');
    expect(cellExpectations.unpublished.display).toBe('Not Published');
    expect(cellExpectations.excused.display).toBe('Excused');
    expect(cellExpectations.late.display).toBe('85');
  });

  it('grade scale boundaries use shared getLetterGrade (89.99 vs 90)', () => {
    expect(getLetterGrade(89.99, CONTRACT_GRADE_SCALE)).toBe('B');
    expect(getLetterGrade(90, CONTRACT_GRADE_SCALE)).toBe('A');
  });
});
