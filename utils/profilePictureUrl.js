const path = require('path');
const fs = require('fs');
const FileAsset = require('../models/fileAsset.model');
const User = require('../models/user.model');
const { getSignedCloudinaryUrl } = require('./cloudinary');
const { paths } = require('../config/paths');

const FILE_ASSET_ID_RE = /\/api\/files\/([a-f0-9]{24})/i;

function getPublicApiBase() {
  const candidates = [
    process.env.PUBLIC_API_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.API_PUBLIC_URL,
  ].filter(Boolean);
  if (candidates.length) {
    const base = String(candidates[0]).replace(/\/$/, '');
    return base.endsWith('/api') ? base.slice(0, -4) : base;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:5000';
  }
  return '';
}

function legacyPathVariants(profilePicture) {
  const raw = String(profilePicture || '').trim();
  if (!raw || raw.startsWith('http')) return [];
  const basename = raw.replace(/^\/uploads\//, '');
  const variants = new Set([raw, `/uploads/${basename}`, basename]);
  return [...variants];
}

function cloudinaryDisplayUrl(asset) {
  if (asset?.provider === 'cloudinary' && asset.metadata?.providerUrl) {
    return (
      getSignedCloudinaryUrl(asset.metadata.providerUrl, {
        download: false,
        resourceType: asset.metadata?.resourceType || 'image',
      }) || asset.metadata.providerUrl
    );
  }
  return null;
}

async function findProfileAsset(profilePicture) {
  const raw = String(profilePicture || '').trim();
  if (!raw || raw.startsWith('http')) return null;

  const fileIdMatch = raw.match(FILE_ASSET_ID_RE);
  if (fileIdMatch) {
    const byId = await FileAsset.findById(fileIdMatch[1]).lean();
    if (byId && !byId.isDeleted) return byId;
  }

  const variants = legacyPathVariants(raw);
  if (!variants.length) return null;

  const or = [];
  for (const v of variants) {
    or.push({ 'migrationMeta.legacyUrl': v });
    or.push({ storageKey: v });
    or.push({ storageKey: `legacy/${v.replace(/^\/uploads\//, '')}` });
    or.push({ originalName: path.basename(v) });
  }

  return FileAsset.findOne({
    category: 'profile',
    isDeleted: { $ne: true },
    $or: or,
  }).lean();
}

function localProfileFileExists(profilePicture) {
  const basename = String(profilePicture || '').trim().replace(/^\/uploads\//, '');
  if (!basename) return false;
  const candidates = [
    path.join(paths.uploads, basename),
    path.join(paths.uploads, 'legacy', basename),
    path.join(paths.uploads, 'public', 'profile', basename),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

async function clearStaleProfilePicture(userId, profilePicture) {
  if (!userId) return;
  await User.updateOne(
    { _id: userId, profilePicture: String(profilePicture || '').trim() },
    { $set: { profilePicture: '' } }
  ).catch(() => {});
}

/**
 * Resolve a stored profilePicture value to a browser-loadable URL (Cloudinary or API host).
 * Returns '' when the reference is broken (missing file + no FileAsset) to avoid CORB on 404 JSON.
 */
async function resolveProfilePictureUrl(profilePicture, { userId } = {}) {
  const raw = String(profilePicture || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  const asset = await findProfileAsset(raw);
  const cloudinary = cloudinaryDisplayUrl(asset);
  if (cloudinary) return cloudinary;

  if (asset?.storageKey) {
    const assetLocal = path.join(paths.uploads, asset.storageKey);
    if (fs.existsSync(assetLocal)) {
      const rel = path.relative(paths.uploads, assetLocal).replace(/\\/g, '/');
      const servedPath = `/uploads/${rel}`;
      const apiBase = getPublicApiBase();
      return apiBase ? `${apiBase}${servedPath}` : servedPath;
    }
    const cloudinaryFromAsset = cloudinaryDisplayUrl(asset);
    if (cloudinaryFromAsset) return cloudinaryFromAsset;
  }

  if (!localProfileFileExists(raw)) {
    await clearStaleProfilePicture(userId, raw);
    return '';
  }

  const basename = raw.replace(/^\/uploads\//, '');
  const uploadPath = `/uploads/${basename}`;
  const apiBase = getPublicApiBase();
  return apiBase ? `${apiBase}${uploadPath}` : uploadPath;
}

/** Redirect target when a legacy profile file is missing on disk (uploads middleware). */
async function resolveProfilePictureRedirectUrl(relativeFilename) {
  const url = await resolveProfilePictureUrl(relativeFilename);
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const apiBase = getPublicApiBase();
  if (!apiBase) return null;
  return `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
}

async function mapUsersWithResolvedProfilePictures(users) {
  if (!Array.isArray(users) || users.length === 0) return users;
  return Promise.all(
    users.map(async (user) => {
      if (!user || typeof user !== 'object') return user;
      if (!user.profilePicture) return user;
      return {
        ...user,
        profilePicture: await resolveProfilePictureUrl(user.profilePicture, { userId: user._id }),
      };
    })
  );
}

module.exports = {
  resolveProfilePictureUrl,
  resolveProfilePictureRedirectUrl,
  mapUsersWithResolvedProfilePictures,
  getPublicApiBase,
};
