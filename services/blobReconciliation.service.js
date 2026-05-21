const fs = require('fs');
const path = require('path');
const FileAsset = require('../models/fileAsset.model');
const { paths } = require('../config/paths');
const { walkUploadsDir, sha256File } = require('../utils/fileBlobUtils');
const { writeReport, formatHumanSummary } = require('../utils/fileReports');

async function loadLatestExportBlobInventory() {
  const exportRoot = paths.institutionExports;
  if (!fs.existsSync(exportRoot)) return null;

  const batches = fs
    .readdirSync(exportRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();

  for (const batch of batches) {
    const manifestPath = path.join(exportRoot, batch, 'blob-manifest.json');
    const uploadsMetaPath = path.join(exportRoot, batch, 'uploadsMetadata.json');
    if (fs.existsSync(manifestPath)) {
      return { batchId: batch, manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) };
    }
    if (fs.existsSync(uploadsMetaPath)) {
      const meta = JSON.parse(fs.readFileSync(uploadsMetaPath, 'utf8'));
      return { batchId: batch, manifest: meta.blobInventory || meta };
    }
  }
  return null;
}

async function runBlobReconciliation(options = {}) {
  const assets = await FileAsset.find({ isDeleted: false }).lean();
  const diskFiles = walkUploadsDir();
  const diskSet = new Set(diskFiles.map((f) => f.relativePath));
  const assetKeys = new Set(assets.map((a) => a.storageKey));

  const dbWithoutBlob = [];
  const blobWithoutDb = [];
  const checksumDrift = [];
  const providerMismatch = [];
  const duplicateBlobs = new Map();

  for (const asset of assets) {
    if (asset.provider === 'local' && !diskSet.has(asset.storageKey)) {
      const alt = asset.path?.replace(/^\/uploads\//, '');
      if (!alt || !diskSet.has(alt)) {
        dbWithoutBlob.push({ fileAssetId: String(asset._id), storageKey: asset.storageKey });
      }
    }
    if (asset.provider === 'cloudinary' && !asset.metadata?.providerUrl) {
      providerMismatch.push({ fileAssetId: String(asset._id), issue: 'missing_provider_url' });
    }

    const localPath = path.join(paths.uploads, asset.storageKey);
    if (fs.existsSync(localPath) && asset.checksumSha256) {
      try {
        const { checksum } = sha256File(localPath);
        if (checksum !== asset.checksumSha256) {
          checksumDrift.push({ fileAssetId: String(asset._id), expected: asset.checksumSha256, actual: checksum });
        }
        const group = duplicateBlobs.get(checksum) || [];
        group.push(String(asset._id));
        duplicateBlobs.set(checksum, group);
      } catch {
        /* skip */
      }
    }
  }

  for (const disk of diskFiles) {
    if (!assetKeys.has(disk.relativePath)) {
      blobWithoutDb.push({ relativePath: disk.relativePath });
    }
  }

  const exportRef = await loadLatestExportBlobInventory();
  const exportMismatch = [];
  if (exportRef?.manifest) {
    const inventory = Array.isArray(exportRef.manifest)
      ? exportRef.manifest
      : exportRef.manifest.blobInventory || [];
    const exportIds = new Set(inventory.map((i) => i.fileAssetId).filter(Boolean));
    for (const asset of assets) {
      if (!exportIds.has(String(asset._id)) && asset.category !== 'temporary') {
        exportMismatch.push({ fileAssetId: String(asset._id), reason: 'missing_from_export_inventory' });
      }
    }
  }

  const duplicateGroups = [...duplicateBlobs.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([checksum, ids]) => ({ checksum, fileAssetIds: ids }));

  const report = {
    generatedAt: new Date().toISOString(),
    exportBatchId: exportRef?.batchId || null,
    summary: {
      totalAssets: assets.length,
      diskFileCount: diskFiles.length,
      dbWithoutBlob: dbWithoutBlob.length,
      blobWithoutDb: blobWithoutDb.length,
      checksumDrift: checksumDrift.length,
      providerMismatch: providerMismatch.length,
      exportMismatch: exportMismatch.length,
      duplicateBlobGroups: duplicateGroups.length,
    },
    dbWithoutBlob: dbWithoutBlob.slice(0, options.limit || 300),
    blobWithoutDb: blobWithoutDb.slice(0, options.limit || 300),
    checksumDrift: checksumDrift.slice(0, 100),
    providerMismatch,
    exportMismatch: exportMismatch.slice(0, 200),
    duplicateBlobGroups: duplicateGroups,
  };

  const jsonPath = writeReport('blob-reconciliation-report.json', report);
  const human = formatHumanSummary('Blob Reconciliation Report', report.summary);
  fs.writeFileSync(jsonPath.replace('.json', '.txt'), human, 'utf8');

  return { report, reportPath: jsonPath };
}

module.exports = {
  runBlobReconciliation,
  loadLatestExportBlobInventory,
};
