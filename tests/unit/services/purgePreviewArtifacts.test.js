jest.mock('../../../services/previewStorage.service', () => ({
  invalidatePreviewCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../models/previewManifest.model', () => ({
  deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
}));

const previewStorage = require('../../../services/previewStorage.service');
const PreviewManifest = require('../../../models/previewManifest.model');
const { purgePreviewArtifacts } = require('../../../services/filePreviewJob.service');

describe('purgePreviewArtifacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('invalidates cloud/local preview cache and removes manifest', async () => {
    await purgePreviewArtifacts('507f1f77bcf86cd799439011');

    expect(previewStorage.invalidatePreviewCache).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(PreviewManifest.deleteOne).toHaveBeenCalledWith({
      fileAssetId: '507f1f77bcf86cd799439011',
    });
  });

  test('no-ops without fileAssetId', async () => {
    await purgePreviewArtifacts(null);
    expect(previewStorage.invalidatePreviewCache).not.toHaveBeenCalled();
    expect(PreviewManifest.deleteOne).not.toHaveBeenCalled();
  });
});
