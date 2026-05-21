const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FileAsset = require('../../models/fileAsset.model');
const { paths, isPathInside } = require('../../config/paths');

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function loadManifest(bundleRoot) {
  const manifestPath = path.join(bundleRoot, 'manifest.json');
  const blobManifestPath = path.join(bundleRoot, 'blob-manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const blobManifest = fs.existsSync(blobManifestPath)
    ? JSON.parse(fs.readFileSync(blobManifestPath, 'utf8'))
    : { entries: [] };
  return { manifest, blobManifest };
}

function loadCheckpoint(bundleRoot) {
  const cpPath = path.join(bundleRoot, 'checkpoint.json');
  if (!fs.existsSync(cpPath)) return { restored: [], lastIndex: 0 };
  return JSON.parse(fs.readFileSync(cpPath, 'utf8'));
}

function saveCheckpoint(bundleRoot, checkpoint) {
  fs.writeFileSync(path.join(bundleRoot, 'checkpoint.json'), JSON.stringify(checkpoint, null, 2));
}

/**
 * Rehydrate local blobs from institution export bundle (U31F).
 */
async function restoreBlobsFromBundle(bundleRoot, options = {}) {
  const dryRun = options.dryRun !== false;
  const resume = options.resume !== false;
  const { blobManifest } = loadManifest(bundleRoot);
  const entries = blobManifest.entries || blobManifest.assets || [];
  const blobsDir = path.join(bundleRoot, 'blobs');
  const checkpoint = resume ? loadCheckpoint(bundleRoot) : { restored: [], lastIndex: 0, missing: [] };
  const restoredSet = new Set(checkpoint.restored || []);

  const report = {
    dryRun,
    total: entries.length,
    restored: 0,
    skipped: 0,
    missing: [],
    checksumMismatch: [],
    protectedSkipped: [],
  };

  for (let i = checkpoint.lastIndex || 0; i < entries.length; i++) {
    const entry = entries[i];
    const fileAssetId = entry.fileAssetId || entry._id;
    if (!fileAssetId) continue;
    if (restoredSet.has(fileAssetId)) {
      report.skipped += 1;
      continue;
    }

    const asset = await FileAsset.findById(fileAssetId);
    if (!asset) {
      report.missing.push({ fileAssetId, reason: 'db_record_missing' });
      checkpoint.lastIndex = i + 1;
      continue;
    }
    if (asset.lifecycleLocked && !options.force) {
      report.protectedSkipped.push(fileAssetId);
      checkpoint.lastIndex = i + 1;
      continue;
    }

    const bundleRel = entry.bundlePath || `blobs/${fileAssetId}${path.extname(asset.originalName || '')}`;
    const src = path.join(bundleRoot, bundleRel);
    if (!fs.existsSync(src)) {
      report.missing.push({ fileAssetId, reason: 'blob_missing_in_bundle', path: bundleRel });
      checkpoint.lastIndex = i + 1;
      continue;
    }

    const buf = fs.readFileSync(src);
    const hash = sha256Buffer(buf);
    if (asset.checksumSha256 && asset.checksumSha256 !== hash) {
      report.checksumMismatch.push({ fileAssetId, expected: asset.checksumSha256, actual: hash });
      checkpoint.lastIndex = i + 1;
      continue;
    }

    if (!dryRun) {
      const destRel = asset.storageKey || `academic/${asset.courseId || 'global'}/${asset.category}/${fileAssetId}${path.extname(asset.originalName || '')}`;
      const dest = path.join(paths.uploads, destRel.replace(/^\/uploads\//, ''));
      const destResolved = path.resolve(dest);
      if (!isPathInside(paths.uploads, destResolved)) {
        report.missing.push({ fileAssetId, reason: 'invalid_dest_path' });
        checkpoint.lastIndex = i + 1;
        continue;
      }
      fs.mkdirSync(path.dirname(destResolved), { recursive: true });
      fs.copyFileSync(src, destResolved);
      asset.storageKey = destRel;
      asset.path = destRel;
      asset.provider = asset.provider || 'local';
      asset.checksumSha256 = hash;
      asset.isDeleted = false;
      asset.cleanupState = 'ACTIVE';
      await asset.save();
      restoredSet.add(fileAssetId);
      report.restored += 1;
    } else {
      report.restored += 1;
    }
    checkpoint.lastIndex = i + 1;
    if (!dryRun && i % 25 === 0) {
      checkpoint.restored = [...restoredSet];
      saveCheckpoint(bundleRoot, checkpoint);
    }
  }

  checkpoint.restored = [...restoredSet];
  checkpoint.missing = report.missing;
  if (!dryRun) saveCheckpoint(bundleRoot, checkpoint);
  return report;
}

async function verifyBlobRestoreParity(bundleRoot) {
  const { blobManifest } = loadManifest(bundleRoot);
  const entries = blobManifest.entries || [];
  const report = { total: entries.length, ok: 0, missingDb: 0, missingBlob: 0, checksumFail: 0, issues: [] };

  for (const entry of entries) {
    const id = entry.fileAssetId;
    const asset = await FileAsset.findById(id).lean();
    if (!asset) {
      report.missingDb += 1;
      report.issues.push({ id, reason: 'missing_db' });
      continue;
    }
    const bundleRel = entry.bundlePath;
    if (bundleRel) {
      const src = path.join(bundleRoot, bundleRel);
      if (!fs.existsSync(src)) {
        report.missingBlob += 1;
        report.issues.push({ id, reason: 'missing_bundle_blob' });
        continue;
      }
      if (asset.checksumSha256) {
        const hash = sha256Buffer(fs.readFileSync(src));
        if (hash !== asset.checksumSha256) {
          report.checksumFail += 1;
          report.issues.push({ id, reason: 'checksum_mismatch' });
          continue;
        }
      }
    }
    report.ok += 1;
  }
  report.pass = report.issues.length === 0;
  return report;
}

module.exports = {
  restoreBlobsFromBundle,
  verifyBlobRestoreParity,
  loadCheckpoint,
};
