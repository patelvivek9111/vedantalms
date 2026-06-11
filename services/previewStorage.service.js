const fs = require('fs');
const path = require('path');
const {
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
  deletePreviewFolder,
} = require('../utils/cloudinary');
const { paths, isPathInside } = require('../config/paths');

const PREVIEW_DIR = path.join(paths.uploads, '_previews');

function ensurePreviewDir() {
  if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

/**
 * auto | cloudinary → Cloudinary when configured; local → disk only.
 * Production with Cloudinary uses cloud previews so all API replicas share cache.
 */
function useCloudPreviewStorage() {
  const mode = (process.env.PREVIEW_STORAGE || 'auto').toLowerCase();
  if (mode === 'local') return false;
  if (mode === 'cloudinary') return isCloudinaryConfigured();
  return isCloudinaryConfigured();
}

function isRemotePreviewRef(ref) {
  return typeof ref === 'string' && /^https?:\/\//i.test(ref);
}

async function storePreviewArtifact({ assetId, suffix, buffer, resourceType = 'auto' }) {
  if (useCloudPreviewStorage()) {
    const result = await uploadBufferToCloudinary(buffer, {
      folder: `lms/previews/${assetId}`,
      public_id: suffix,
      resource_type: resourceType,
      overwrite: true,
    });
    return result.url;
  }

  ensurePreviewDir();
  const localPath = path.join(PREVIEW_DIR, `${assetId}-${suffix}`);
  fs.writeFileSync(localPath, buffer);
  return localPath;
}

async function storePreviewJson({ assetId, suffix, data }) {
  const payload = Buffer.from(JSON.stringify(data));
  return storePreviewArtifact({
    assetId,
    suffix,
    buffer: payload,
    resourceType: 'raw',
  });
}

async function storePreviewText({ assetId, suffix, text }) {
  return storePreviewArtifact({
    assetId,
    suffix,
    buffer: Buffer.from(String(text).slice(0, 100000), 'utf8'),
    resourceType: 'raw',
  });
}

async function invalidatePreviewCache(fileAssetId) {
  const prefix = String(fileAssetId);

  if (fs.existsSync(PREVIEW_DIR)) {
    for (const name of fs.readdirSync(PREVIEW_DIR)) {
      if (name.startsWith(prefix)) {
        try {
          fs.unlinkSync(path.join(PREVIEW_DIR, name));
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (useCloudPreviewStorage()) {
    await deletePreviewFolder(fileAssetId);
  }
}

function resolveSecurePreviewRef(manifest, kind = 'thumbnail') {
  if (!manifest) return null;
  const ref =
    kind === 'pdf' || kind === 'content'
      ? manifest.previewPath
      : manifest.thumbnailPath || manifest.previewPath || manifest.posterPath;
  if (!ref) return null;

  if (isRemotePreviewRef(ref)) {
    return { type: 'remote', url: ref };
  }

  if (!fs.existsSync(ref)) return null;
  const resolved = path.resolve(ref);
  if (!isPathInside(paths.uploads, resolved)) return null;
  return { type: 'local', path: ref };
}

module.exports = {
  PREVIEW_DIR,
  ensurePreviewDir,
  useCloudPreviewStorage,
  storePreviewArtifact,
  storePreviewJson,
  storePreviewText,
  invalidatePreviewCache,
  resolveSecurePreviewRef,
  isRemotePreviewRef,
};
