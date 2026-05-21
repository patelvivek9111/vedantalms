const fs = require('fs');
const path = require('path');
const FileAsset = require('../../models/fileAsset.model');
const { hashContent } = require('../../shared/portability/exportUtils.cjs');
const { paths, isPathInside } = require('../../config/paths');
const { resolveLocalPathFromUrl } = require('../../utils/fileBlobUtils');

/**
 * Build blob inventory + optional binary copy for institution export (U7.6).
 * Does not upload to external storage — local bundle preparation only.
 */
async function buildBlobManifestForExport(exportRoot, batchId, options = {}) {
  const includeBinaries = options.includeBinaries === true;
  const blobsDir = path.join(exportRoot.resolvePath(batchId), 'blobs');
  const checksumsDir = path.join(exportRoot.resolvePath(batchId), 'checksums');

  if (includeBinaries) {
    if (!fs.existsSync(blobsDir)) fs.mkdirSync(blobsDir, { recursive: true });
    if (!fs.existsSync(checksumsDir)) fs.mkdirSync(checksumsDir, { recursive: true });
  }

  const assets = await FileAsset.find({ isDeleted: false }).lean();
  const entries = [];
  const missing = [];

  for (const asset of assets) {
    const entry = {
      fileAssetId: String(asset._id),
      storageKey: asset.storageKey,
      provider: asset.provider,
      checksumSha256: asset.checksumSha256,
      size: asset.size,
      category: asset.category,
      courseId: asset.courseId ? String(asset.courseId) : null,
      included: false,
    };

    if (includeBinaries && asset.provider === 'local') {
      const local =
        resolveLocalPathFromUrl(asset.path) || path.join(paths.uploads, asset.storageKey);
      if (fs.existsSync(local) && isPathInside(paths.uploads, path.resolve(local))) {
        const destName = `${asset._id}${path.extname(asset.originalName || '')}`;
        const dest = path.join(blobsDir, destName);
        fs.copyFileSync(local, dest);
        entry.included = true;
        entry.bundlePath = `blobs/${destName}`;
        if (asset.checksumSha256) {
          fs.writeFileSync(
            path.join(checksumsDir, `${asset._id}.sha256`),
            `${asset.checksumSha256}  ${destName}\n`
          );
        }
      } else {
        missing.push({ fileAssetId: String(asset._id), reason: 'blob_missing' });
      }
    } else if (asset.metadata?.providerUrl) {
      entry.providerUrl = asset.metadata.providerUrl;
      entry.included = false;
      entry.note = 'cloud_reference_only';
    }

    entries.push(entry);
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    includeBinaries,
    totalAssets: assets.length,
    includedCount: entries.filter((e) => e.included).length,
    missingCount: missing.length,
    entries,
    missing,
    manifestHash: hashContent(JSON.stringify(entries)),
  };

  await exportRoot.writeFile(path.join(batchId, 'blob-manifest.json'), manifest);
  return manifest;
}

module.exports = {
  buildBlobManifestForExport,
};
