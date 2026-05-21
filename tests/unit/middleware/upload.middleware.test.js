const mockMulter = jest.fn((config) => {
  const handler = (req, res, next) => next();
  handler.__config = config;
  return handler;
});
mockMulter.memoryStorage = jest.fn(() => 'MEMORY_STORAGE');
mockMulter.diskStorage = jest.fn(() => 'DISK_STORAGE');

jest.mock('multer', () => mockMulter);

jest.mock('../../../utils/fileSettings', () => ({
  loadUploadSettings: jest.fn(() =>
    Promise.resolve({
      maxFileSizeBytes: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'application/pdf'],
    })
  ),
  DEFAULT_MAX_BYTES: 10 * 1024 * 1024,
  DEFAULT_ALLOWED_MIMES: ['image/jpeg'],
}));

describe('middleware/upload', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.FORCE_OBJECT_STORAGE;
  });

  test('builds multer with memory storage when cloudinary is configured', async () => {
    jest.doMock('../../../utils/cloudinary', () => ({
      isCloudinaryConfigured: jest.fn(() => true),
    }));

    const upload = require('../../../middleware/upload');
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await upload.single('file')(req, res, () => {});

    expect(mockMulter.memoryStorage).toHaveBeenCalled();
    const cfg = mockMulter.mock.calls[mockMulter.mock.calls.length - 1][0];
    expect(cfg.limits.fileSize).toBe(10 * 1024 * 1024);
  });

  test('builds multer with disk storage when cloudinary is disabled', async () => {
    jest.doMock('../../../utils/cloudinary', () => ({
      isCloudinaryConfigured: jest.fn(() => false),
    }));

    const upload = require('../../../middleware/upload');
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await upload.array('files', 5)(req, res, () => {});

    expect(mockMulter.diskStorage).toHaveBeenCalled();
  });
});

