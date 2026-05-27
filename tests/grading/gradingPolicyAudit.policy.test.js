const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
require('../../models/user.model');
const gradingPolicyAuditService = require('../../services/gradingPolicyAudit.service');
const gradingPolicyService = require('../../services/gradingPolicy.service');
const GradingPolicyAudit = require('../../models/gradingPolicyAudit.model');

describe('gradingPolicyAudit', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('records institution policy changes with diff summary', async () => {
    const actorId = new mongoose.Types.ObjectId();
    const inst = await gradingPolicyService.getInstitutionPolicyDocument();
    const original = { ...inst.policy };

    await gradingPolicyService.updateInstitutionPolicy(
      {
        ...original,
        latePenalty: { ...original.latePenalty, enabled: true, perDayPercent: 7 },
      },
      actorId
    );

    const history = await GradingPolicyAudit.find({ entityType: 'institution' }).lean();
    expect(history.length).toBeGreaterThanOrEqual(1);
    const latest = history[history.length - 1];
    expect(latest.oldHash).toBeTruthy();
    expect(latest.newHash).not.toBe(latest.oldHash);
    expect(latest.diffSummary.changed.length).toBeGreaterThan(0);

    const listed = await gradingPolicyAuditService.listAuditHistory('institution', 'default', {
      limit: 5,
    });
    expect(listed.length).toBeGreaterThanOrEqual(1);
  });
});
