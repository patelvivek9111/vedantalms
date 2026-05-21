const blobRetention = require('../../services/blobRetention.service');

jest.mock('../../models/systemSettings.model', () => ({
  findOne: jest.fn().mockResolvedValue({ storage: { deletedBlobRetentionDays: 30 } }),
}));

describe('blob retention policy', () => {
  it('reports ineligible when quarantine missing', () => {
    const asset = { _id: '507f1f77bcf86cd799439011', isDeleted: true, metadata: {} };
    const el = blobRetention.getRestoreEligibility(asset);
    expect(el.eligible).toBe(false);
    expect(el.reason).toBe('blob_purged_or_missing');
  });

  it('reports active files as eligible', () => {
    const el = blobRetention.getRestoreEligibility({ isDeleted: false, cleanupState: 'ACTIVE' });
    expect(el.eligible).toBe(true);
  });
});
