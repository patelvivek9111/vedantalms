/**
 * Wave E: unified audit timeline + provenance.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const academicAuditTimelineService = require('../../services/academicAuditTimeline.service');
const gradeLifecycleService = require('../../services/gradeLifecycle.service');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');

describe('academicAuditTimeline (Wave E)', () => {
  let mongoServer;
  let contract;
  let registrar;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    contract = await seedGradingContractE2E();
    registrar = await User.create({
      firstName: 'Reg',
      lastName: 'Audit',
      email: `reg.audit.${Date.now()}@example.com`,
      password: 'password123',
      role: 'registrar',
    });
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('returns provenance with policy chain and engine version', async () => {
    const course = await Course.findById(contract.courseId);
    const prov = await academicAuditTimelineService.getCourseGradeProvenance(course);
    expect(prov.term).toBe('Spring');
    expect(prov.year).toBe(2025);
    expect(prov.gradingEngineVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(prov.effectivePolicyHash).toBeTruthy();
    expect(prov.policyChain.resolved.hash).toBe(prov.effectivePolicyHash);
  });

  it('timeline includes lifecycle finalize after posting and finalizing', async () => {
    const teacher = await User.findById(contract.teacherId);
    await gradeLifecycleService.transitionToPosted(contract.courseId, teacher);
    await gradeLifecycleService.transitionToFinalized(contract.courseId, registrar);

    const course = await Course.findById(contract.courseId);
    const timeline = await academicAuditTimelineService.getCourseAuditTimeline(course);
    const actions = timeline.map((e) => e.action);
    expect(actions).toContain('lifecycle_finalized');
    expect(actions.some((a) => a.includes('lifecycle') || a.includes('grades'))).toBe(true);
  });
});
