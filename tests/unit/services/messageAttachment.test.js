jest.mock('../../../services/fileAsset.service', () => ({
  validateFileAssetIdsForAttach: jest.fn(),
  attachFileAssets: jest.fn().mockResolvedValue(undefined),
}));

const fileAssetService = require('../../../services/fileAsset.service');
const messageAttachment = require('../../../services/messageAttachment.service');

describe('messageAttachment.service', () => {
  const originalRejectLegacy = process.env.INBOX_REJECT_LEGACY_ATTACHMENTS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.INBOX_REJECT_LEGACY_ATTACHMENTS;
    fileAssetService.validateFileAssetIdsForAttach.mockResolvedValue([
      { _id: '507f1f77bcf86cd799439012' },
    ]);
  });

  afterAll(() => {
    process.env.INBOX_REJECT_LEGACY_ATTACHMENTS = originalRejectLegacy;
  });

  it('validates and promotes fileAssetIds to message category', async () => {
    const user = { _id: '507f1f77bcf86cd799439011' };
    const result = await messageAttachment.resolveMessageAttachments({
      user,
      courseId: '507f1f77bcf86cd799439013',
      fileAssetIds: ['507f1f77bcf86cd799439012'],
      legacyAttachments: [],
    });

    expect(fileAssetService.validateFileAssetIdsForAttach).toHaveBeenCalledWith(
      ['507f1f77bcf86cd799439012'],
      expect.objectContaining({ category: 'message', ownerOnly: true })
    );
    expect(fileAssetService.attachFileAssets).toHaveBeenCalledWith(
      ['507f1f77bcf86cd799439012'],
      expect.objectContaining({ category: 'message' })
    );
    expect(result.fileAssetIds).toHaveLength(1);
    expect(result.attachments).toEqual([]);
  });

  it('keeps non-file legacy URLs when rejection flag is off', async () => {
    const result = await messageAttachment.resolveMessageAttachments({
      user: { _id: 'u1' },
      fileAssetIds: [],
      legacyAttachments: ['/uploads/legacy.pdf'],
    });

    expect(result.attachments).toEqual(['/uploads/legacy.pdf']);
    expect(fileAssetService.validateFileAssetIdsForAttach).not.toHaveBeenCalled();
  });

  it('rejects legacy URLs when INBOX_REJECT_LEGACY_ATTACHMENTS=true', async () => {
    process.env.INBOX_REJECT_LEGACY_ATTACHMENTS = 'true';

    await expect(
      messageAttachment.resolveMessageAttachments({
        user: { _id: 'u1' },
        legacyAttachments: ['/uploads/legacy.pdf'],
      })
    ).rejects.toMatchObject({ code: 'LEGACY_ATTACHMENTS_REJECTED', statusCode: 400 });
  });

  it('extracts file asset id from secure download URL in legacy attachments', async () => {
    const assetId = '507f1f77bcf86cd799439012';
    await messageAttachment.resolveMessageAttachments({
      user: { _id: '507f1f77bcf86cd799439011' },
      legacyAttachments: [`/api/files/${assetId}/download`],
    });

    expect(fileAssetService.validateFileAssetIdsForAttach).toHaveBeenCalledWith(
      [assetId],
      expect.any(Object)
    );
  });
});
