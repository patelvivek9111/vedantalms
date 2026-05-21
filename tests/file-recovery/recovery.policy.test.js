const fileRecoveryCenter = require('../../services/fileRecoveryCenter.service');

jest.mock('../../models/fileAsset.model', () => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  }),
  findById: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../../models/systemAuditEvent.model', () => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('../../services/academicAudit.service', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('file recovery center policy', () => {
  it('rejects non-admin restore', async () => {
    await expect(
      fileRecoveryCenter.restoreDeletedFile('507f1f77bcf86cd799439011', { _id: 'u1', role: 'student' }, {})
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
