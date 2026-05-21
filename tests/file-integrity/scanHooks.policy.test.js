const {
  assertSafeForDownload,
  markFileUnsafe,
} = require('../../services/fileScan.service');

jest.mock('../../models/fileAsset.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../services/academicAudit.service', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue({}),
}));

const FileAsset = require('../../models/fileAsset.model');

describe('virus scan hooks (architecture only)', () => {
  test('unsafe files cannot be downloaded', () => {
    expect(() => assertSafeForDownload({ scanStatus: 'unsafe' })).toThrow(/safety scan/);
  });

  test('markFileUnsafe locks asset', async () => {
    const save = jest.fn();
    FileAsset.findById.mockResolvedValue({
      _id: '507f191e805fc199af442303',
      scanStatus: 'pending',
      scanMeta: {},
      lifecycleLocked: false,
      save,
    });

    const asset = await markFileUnsafe('507f191e805fc199af442303', 'test');
    expect(save).toHaveBeenCalled();
    expect(asset.scanStatus).toBe('unsafe');
    expect(asset.lifecycleLocked).toBe(true);
  });
});
