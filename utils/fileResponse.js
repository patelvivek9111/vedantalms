const FileAsset = require('../models/fileAsset.model');
const { serializeFileAsset } = require('../services/fileAsset.service');

async function loadSerializedFileAssets(fileAssetIds, userId = null) {
  if (!fileAssetIds?.length) return [];
  const assets = await FileAsset.find({ _id: { $in: fileAssetIds }, isDeleted: false }).lean();
  return assets.map((a) => serializeFileAsset(a, userId)).filter(Boolean);
}

/**
 * Merge canonical file asset download URLs with legacy string paths for API backward compatibility.
 */
async function buildClientFileList(doc, userId = null) {
  const ids = new Set();
  for (const id of doc.fileAssets || []) {
    if (id) ids.add(String(id));
  }
  const legacyUrls = [...(doc.files || []), ...(doc.attachments || [])].filter(Boolean);
  for (const url of legacyUrls) {
    if (typeof url !== 'string') continue;
    const match = url.match(/\/api\/files\/([a-f0-9]{24})/i);
    if (match) ids.add(match[1]);
  }

  const fromAssets = await loadSerializedFileAssets([...ids], userId);
  const seenUrls = new Set(fromAssets.map((f) => f.url));
  const merged = [...fromAssets];

  for (const url of legacyUrls) {
    if (typeof url !== 'string') continue;
    if (url.includes('/api/files/')) continue;
    if (!seenUrls.has(url)) {
      merged.push({ url, legacy: true });
      seenUrls.add(url);
    }
  }

  return merged;
}

module.exports = {
  loadSerializedFileAssets,
  buildClientFileList,
};
