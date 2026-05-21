const { verifyBlobRestoreParity } = require('../../services/import/blobRestore.service');

jest.mock('../../models/fileAsset.model', () => ({
  findById: jest.fn().mockResolvedValue({
    _id: '507f1f77bcf86cd799439011',
    checksumSha256: 'abc',
    originalName: 'test.pdf',
    lifecycleLocked: false,
  }),
}));

describe('blob restore parity', () => {
  it('returns pass when no entries', async () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blob-restore-'));
    fs.writeFileSync(path.join(tmp, 'blob-manifest.json'), JSON.stringify({ entries: [] }));
    const report = await verifyBlobRestoreParity(tmp);
    expect(report.pass).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
