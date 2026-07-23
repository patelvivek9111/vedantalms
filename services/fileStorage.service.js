const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { getStorageService } = require('./storage');
const { paths, isPathInside } = require('../config/paths');

/**
 * Academic blob storage — all HTTP uploads route through here (Phase U4).
 */
async function storeMulterFile(file, options = {}) {
  const storage = getStorageService();
  const category = options.category || 'temporary';
  const courseId = options.courseId ? String(options.courseId) : 'global';
  const assetId = options.assetId || crypto.randomBytes(12).toString('hex');
  const ext = path.extname(file.originalname || '') || '';
  const { getTenantRootAccountId } = require('../utils/tenantContext');
  const rootPrefix = options.rootAccountId || getTenantRootAccountId() || 'shared';
  const storageKey =
    category === 'profile'
      ? `${rootPrefix}/public/profile/${assetId}${ext}`
      : `${rootPrefix}/academic/${courseId}/${category}/${assetId}${ext}`;

  const folder = options.cloudinaryFolder || `lms/${rootPrefix}/academic/${category}`;
  const uploadResult = await storage.uploads.uploadFile(file, {
    folder,
    resource_type: options.resourceType || 'auto',
    relativePath: storageKey,
  });

  return {
    storageKey,
    provider: uploadResult.provider || storage.provider,
    bucket: options.bucket || '',
    path: uploadResult.path || storageKey,
    size: file.size || uploadResult.metadata?.bytes || 0,
    providerUrl: uploadResult.url || null,
    rootAccountId: rootPrefix !== 'shared' ? rootPrefix : null,
  };
}

async function readStoredContent(fileAsset) {
  const storage = getStorageService();
  if (fileAsset.provider === 'cloudinary' && fileAsset.metadata?.providerUrl) {
    const res = await fetch(fileAsset.metadata.providerUrl);
    if (!res.ok) throw new Error('Failed to fetch cloud file');
    return Buffer.from(await res.arrayBuffer());
  }

  const relative = fileAsset.storageKey || fileAsset.path;
  const localPath = path.join(paths.uploads, relative.replace(/^\/uploads\//, ''));
  const resolved = path.resolve(localPath);
  if (!isPathInside(paths.uploads, resolved)) {
    throw new Error('Invalid storage path');
  }
  if (!fs.existsSync(resolved)) {
    const legacy = path.resolve(paths.uploads, String(fileAsset.path || '').replace(/^\/uploads\//, ''));
    if (fs.existsSync(legacy) && isPathInside(paths.uploads, legacy)) {
      return fs.readFileSync(legacy);
    }
    throw new Error('File not found on disk');
  }
  return fs.readFileSync(resolved);
}

function createReadStreamForAsset(fileAsset) {
  const relative = fileAsset.storageKey || fileAsset.path;
  const localPath = path.join(paths.uploads, String(relative).replace(/^\/uploads\//, ''));
  const resolved = path.resolve(localPath);
  if (!isPathInside(paths.uploads, resolved) || !fs.existsSync(resolved)) {
    const legacy = path.resolve(paths.uploads, String(fileAsset.path || '').replace(/^\/uploads\//, ''));
    if (fs.existsSync(legacy) && isPathInside(paths.uploads, legacy)) {
      return fs.createReadStream(legacy);
    }
    return null;
  }
  return fs.createReadStream(resolved);
}

async function deleteStoredBlob(fileAsset) {
  const storage = getStorageService();
  if (fileAsset.provider === 'cloudinary') {
    const url = fileAsset.metadata?.providerUrl;
    if (url) await storage.uploads.deleteByUrl(url);
    return;
  }
  const stream = createReadStreamForAsset(fileAsset);
  if (!stream) return;
  const resolved = stream.path;
  try {
    await fs.promises.unlink(resolved);
  } catch {
    /* ignore */
  }
}

module.exports = {
  storeMulterFile,
  readStoredContent,
  createReadStreamForAsset,
  deleteStoredBlob,
};
