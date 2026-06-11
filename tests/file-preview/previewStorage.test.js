const previewStorage = require('../../services/previewStorage.service');

describe('previewStorage refs', () => {
  test('resolveSecurePreviewRef accepts remote URLs', () => {
    const manifest = {
      thumbnailPath: 'https://res.cloudinary.com/demo/image/upload/v1/lms/previews/abc/thumb.png',
      previewPath: 'https://res.cloudinary.com/demo/raw/upload/v1/lms/previews/abc/preview.pdf',
    };
    const thumb = previewStorage.resolveSecurePreviewRef(manifest, 'thumbnail');
    expect(thumb).toEqual({
      type: 'remote',
      url: manifest.thumbnailPath,
    });
    const content = previewStorage.resolveSecurePreviewRef(manifest, 'content');
    expect(content).toEqual({
      type: 'remote',
      url: manifest.previewPath,
    });
  });

  test('useCloudPreviewStorage follows PREVIEW_STORAGE=local', () => {
    const prev = process.env.PREVIEW_STORAGE;
    process.env.PREVIEW_STORAGE = 'local';
    expect(previewStorage.useCloudPreviewStorage()).toBe(false);
    process.env.PREVIEW_STORAGE = prev;
  });
});
