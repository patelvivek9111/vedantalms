const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const { seedGradingContractE2E } = require('./e2eContractSeed');
const gradingPolicyService = require('../../services/gradingPolicy.service');
const Course = require('../../models/course.model');

describe('effective grading policy', () => {
  let mongoServer;
  let contract;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
    contract = await seedGradingContractE2E();
  }, 120000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('returns institution, course, resolved policy, hash, and version', async () => {
    const course = await Course.findById(contract.courseId).lean();
    const breakdown = await gradingPolicyService.getEffectivePolicyBreakdown(course);
    expect(breakdown.resolvedPolicy).toBeDefined();
    expect(breakdown.resolvedPolicyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(typeof breakdown.resolvedPolicyVersion).toBe('number');
    expect(breakdown.resolvedPolicy.groups.length).toBeGreaterThan(0);
  });
});
