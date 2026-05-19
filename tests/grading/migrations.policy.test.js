/**
 * Wave F: migration runner dry-run + apply (in-memory Mongo).
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const StudentCourseGradeSnapshot = require('../../models/studentCourseGradeSnapshot.model');
const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');
const migrations = require('../../scripts/migrations/registry');
const { runAll } = require('../../scripts/migrations/lib/runner');

describe('grading migrations (Wave F)', () => {
  let mongoServer;
  let contract;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    contract = await seedGradingContractE2E();
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('001 dry-run does not create lifecycle', async () => {
    await StudentCourseGradeSnapshot.create({
      student: contract.studentId,
      course: contract.courseId,
      term: 'Spring',
      year: 2025,
      finalPercent: 83,
      letterGrade: 'B',
      gradingPolicyVersion: 1,
      gradingPolicyHash: 'abc123',
      gradingPolicySnapshot: { groups: [] },
      frozen: true,
      isCurrent: true,
    });

    await CourseGradeLifecycle.deleteMany({ course: contract.courseId });

    const results = await runAll(
      migrations.filter((m) => m.id.startsWith('001')),
      { dryRun: true, force: true }
    );
    expect(results[0].status).toBe('completed');
    expect(results[0].stats.created + results[0].stats.updated).toBeGreaterThan(0);

    const lc = await CourseGradeLifecycle.findOne({ course: contract.courseId });
    expect(lc).toBeNull();
  });

  it('001 apply backfills FINALIZED lifecycle without changing snapshots', async () => {
    const before = await StudentCourseGradeSnapshot.findOne({
      student: contract.studentId,
      course: contract.courseId,
    }).lean();

    const results = await runAll(
      migrations.filter((m) => m.id.startsWith('001')),
      { dryRun: false, force: true }
    );
    expect(results[0].status).toBe('completed');

    const lc = await CourseGradeLifecycle.findOne({ course: contract.courseId }).lean();
    expect(lc.status).toBe('FINALIZED');
    expect(lc.policyHash).toBeTruthy();

    const after = await StudentCourseGradeSnapshot.findById(before._id).lean();
    expect(after.finalPercent).toBe(before.finalPercent);
  });

  it('skips already-completed migration on second apply', async () => {
    const results = await runAll(
      migrations.filter((m) => m.id.startsWith('001')),
      { dryRun: false, force: false }
    );
    expect(results[0].status).toBe('skipped');
  });
});
