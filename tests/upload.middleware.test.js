const mockMulter = jest.fn((config) => ({ __config: config }));
mockMulter.memoryStorage = jest.fn(() => 'MEMORY_STORAGE');
mockMulter.diskStorage = jest.fn(() => 'DISK_STORAGE');

jest.mock('multer', () => mockMulter);

describe('middleware/upload', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.FORCE_OBJECT_STORAGE;
  });

  test('uses memory storage when cloudinary is configured', () => {
    jest.doMock('../utils/cloudinary', () => ({
      isCloudinaryConfigured: jest.fn(() => true)
    }));

    const upload = require('../middleware/upload');
    const cfg = upload.__config;

    expect(mockMulter.memoryStorage).toHaveBeenCalled();
    expect(cfg.limits.fileSize).toBe(10 * 1024 * 1024);
  });

  test('uses disk storage when cloudinary is disabled', () => {
    jest.doMock('../utils/cloudinary', () => ({
      isCloudinaryConfigured: jest.fn(() => false)
    }));

    const upload = require('../middleware/upload');
    const cfg = upload.__config;

    expect(mockMulter.diskStorage).toHaveBeenCalled();
    expect(cfg.storage).toBe('DISK_STORAGE');
  });

  test('rejects invalid file types via fileFilter', () => {
    jest.doMock('../utils/cloudinary', () => ({
      isCloudinaryConfigured: jest.fn(() => false)
    }));

    const upload = require('../middleware/upload');
    const cfg = upload.__config;
    const cb = jest.fn();

    cfg.fileFilter({}, { mimetype: 'application/x-msdownload' }, cb);

    expect(cb).toHaveBeenCalled();
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cb.mock.calls[0][1]).toBe(false);
  });
});

