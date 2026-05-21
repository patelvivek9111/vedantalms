const fileAssetService = require('../../services/fileAsset.service');

describe('fileAsset resolveAttachmentsFromRequest helpers', () => {
  it('parses fileAssetIds from JSON body string', () => {
    const ids = fileAssetService.parseFileAssetIdsFromBody({
      fileAssetIds: '["507f1f77bcf86cd799439011","507f1f77bcf86cd799439012"]',
    });
    expect(ids).toHaveLength(2);
  });

  it('parses fileAssetIds from array body', () => {
    const ids = fileAssetService.parseFileAssetIdsFromBody({
      fileAssetIds: ['507f1f77bcf86cd799439011'],
    });
    expect(ids).toEqual(['507f1f77bcf86cd799439011']);
  });
});
