const FileAsset = require('../models/fileAsset.model');
const { serializeFileAsset } = require('../services/fileAsset.service');

async function loadSerializedFileAssets(fileAssetIds) {
  if (!fileAssetIds?.length) return [];
  const assets = await FileAsset.find({ _id: { $in: fileAssetIds }, isDeleted: false }).lean();
  return assets.map((a) => serializeFileAsset(a));
}

/**
 * Merge canonical file asset download URLs with legacy string paths for API backward compatibility.
 */
async function buildClientFileList(doc) {
  const fromAssets = await loadSerializedFileAssets(doc.fileAssets);
  const legacy = (doc.attachments || doc.files || [])
    .filter(Boolean)
    .map((url) => {
      if (typeof url === 'string' && url.includes('/api/files/')) {
        return { url, legacy: false };
      }
      return { url, legacy: true };
    });
  const assetUrls = new Set(fromAssets.map((f) => f.url));
  const merged = [...fromAssets];
  for (const item of legacy) {
    if (!assetUrls.has(item.url)) merged.push(item);
  }
  return merged;
}

module.exports = {
  loadSerializedFileAssets,
  buildClientFileList,
};
