const multer = require('multer');
const path = require('path');
const { isCloudinaryConfigured } = require('../utils/cloudinary');
const { loadUploadSettings, DEFAULT_MAX_BYTES, DEFAULT_ALLOWED_MIMES } = require('../utils/fileSettings');

const useObjectStorage = isCloudinaryConfigured() && process.env.FORCE_OBJECT_STORAGE !== 'false';

function buildDiskStorage() {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, 'uploads/');
    },
    filename(_req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });
}

function buildFileFilter(allowedMimeTypes) {
  return (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error('Invalid file type. Only images, documents, and common file types are allowed.'),
        false
      );
    }
  };
}

let cachedUpload = null;
let cachedAt = 0;
const CACHE_MS = 60 * 1000;

async function buildUploadMiddleware() {
  const now = Date.now();
  if (cachedUpload && now - cachedAt < CACHE_MS) {
    return cachedUpload;
  }

  const settings = await loadUploadSettings();
  const storage = useObjectStorage ? multer.memoryStorage() : buildDiskStorage();

  cachedUpload = multer({
    storage,
    fileFilter: buildFileFilter(settings.allowedMimeTypes),
    limits: {
      fileSize: settings.maxFileSizeBytes || DEFAULT_MAX_BYTES,
    },
  });
  cachedAt = now;
  return cachedUpload;
}

function invalidateUploadCache() {
  cachedUpload = null;
  cachedAt = 0;
}

/**
 * Dynamic multer wrapper — applies SystemSettings limits and MIME allowlist.
 */
function dynamicUploadHandler(factory) {
  return async (req, res, next) => {
    try {
      const upload = await buildUploadMiddleware();
      return factory(upload)(req, res, (err) => {
        if (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
        return next();
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };
}

const upload = {
  single: (field) => dynamicUploadHandler((u) => u.single(field)),
  array: (field, maxCount) => dynamicUploadHandler((u) => u.array(field, maxCount)),
  __invalidateCache: invalidateUploadCache,
};

module.exports = upload;
