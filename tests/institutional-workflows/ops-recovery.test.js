const fileRecovery = require('../../services/fileRecovery.service');

jest.mock('../../services/fileCleanup.service', () => ({
  detectOrphans: jest.fn(async () => ({
    candidates: [{ assetId: 'a1' }],
    summary: { candidateCount: 1 },
  })),
}));

jest.mock('../../services/courseMaintenance.service', () => ({
  runMaintenanceBundle: jest.fn(async () => ({ dryRun: true })),
}));

jest.mock('../../models/fileAsset.model', () => ({
  find: jest.fn(() => ({
    sort: () => ({
      limit: () => ({
        select: () => ({ lean: async () => [] }),
      }),
    }),
  })),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../models/asyncJob.model', () => ({
  find: jest.fn(() => ({
    sort: () => ({ limit: () => ({ lean: async () => [] }) }),
  })),
  findById: jest.fn(),
}));

describe('ops recovery dry-run', () => {
  it('returns orphan and maintenance preview', async () => {
    const data = await fileRecovery.runRecoveryDryRun();
    expect(data.orphanReport.summary.candidateCount).toBe(1);
    expect(data.maintenance.dryRun).toBe(true);
  });

  it('markOrphanCandidates respects dry-run', async () => {
    const dry = await fileRecovery.markOrphanCandidates({ dryRun: true });
    expect(dry.dryRun).toBe(true);
  });
});
