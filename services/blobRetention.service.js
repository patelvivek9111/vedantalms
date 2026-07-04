const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * Verify quarantine copy integrity before removing live blob (U48F).
 */
function verifyQuarantineCopy(destPath, expectedChecksum) {
  if (!fs.existsSync(destPath)) {
    return { ok: false, reason: 'quarantine_copy_missing' };
  }
  const stat = fs.statSync(destPath);
  if (!stat.isFile() || stat.size === 0) {
    return { ok: false, reason: 'quarantine_copy_empty' };
  }
  if (expectedChecksum) {
    const actual = sha256File(destPath);
    if (actual !== expectedChecksum) {
      return { ok: false, reason: 'checksum_mismatch', expected: expectedChecksum, actual };
    }
  }
  return { ok: true, size: stat.size };
}
const FileAsset = require('../models/fileAsset.model');
const SystemSettings = require('../models/systemSettings.model');
const academicAuditService = require('./academicAudit.service');
const { paths, isPathInside } = require('../config/paths');
const { createReadStreamForAsset, deleteStoredBlob } = require('./fileStorage.service');

const QUARANTINE_DIR = path.join(paths.uploads, '_blob_quarantine');

function ensureQuarantineDir() {
  if (!fs.existsSync(QUARANTINE_DIR)) fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
}

async function getBlobRetentionDays() {
  const settings = await SystemSettings.findOne().lean();
  const storage = settings?.storage || {};
  return storage.deletedBlobRetentionDays ?? storage.deletedFileRetentionDays ?? 30;
}

function quarantinePathForAsset(assetId) {
  return path.join(QUARANTINE_DIR, `${assetId}.bin`);
}

function quarantineMetaPath(assetId) {
  return path.join(QUARANTINE_DIR, `${assetId}.meta.json`);
}

/**
 * Move blob to quarantine instead of immediate physical delete (U37F).
 */
async function quarantineBlob(asset, audit = {}) {
  if (asset.metadata?.legalHold) {
    const err = new Error('File is on legal hold — blob cannot be quarantined');
    err.statusCode = 423;
    throw err;
  }

  if (asset.provider === 'cloudinary') {
    await deleteStoredBlob(asset);
    const filePreviewJob = require('./filePreviewJob.service');
    await filePreviewJob.purgePreviewArtifacts(asset._id).catch(() => {});
    asset.cleanupState = 'SOFT_DELETED';
    asset.metadata = {
      ...(asset.metadata || {}),
      blobDeletedAt: new Date().toISOString(),
      restoreEligible: false,
    };
    await asset.save();
    await academicAuditService.recordAuditEvent({
      actorId: audit.actorId,
      entityType: 'file_asset',
      entityId: asset._id,
      action: 'blob_deleted_remote',
      severity: 'info',
      ip: audit.ip,
      metadata: { provider: 'cloudinary' },
    }).catch(() => {});
    return { quarantined: true, remote: true };
  }

  ensureQuarantineDir();
  const stream = createReadStreamForAsset(asset);
  if (!stream?.path) {
    return { quarantined: false, reason: 'blob_already_missing' };
  }
  const src = stream.path;
  const dest = quarantinePathForAsset(asset._id);
  fs.copyFileSync(src, dest);
  const verification = verifyQuarantineCopy(dest, asset.checksumSha256);
  if (!verification.ok) {
    try {
      fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
    const err = new Error(`Quarantine verification failed: ${verification.reason}`);
    err.statusCode = 500;
    err.verification = verification;
    throw err;
  }
  const meta = {
    fileAssetId: String(asset._id),
    storageKey: asset.storageKey,
    checksumSha256: asset.checksumSha256,
    originalName: asset.originalName,
    quarantinedAt: new Date().toISOString(),
    purgeAfter: new Date(Date.now() + (await getBlobRetentionDays()) * 86400000).toISOString(),
    sourcePath: src,
  };
  fs.writeFileSync(quarantineMetaPath(asset._id), JSON.stringify(meta, null, 2));

  try {
    fs.unlinkSync(src);
  } catch {
    /* source may already be gone */
  }

  asset.cleanupState = 'SOFT_DELETED';
  asset.metadata = {
    ...(asset.metadata || {}),
    blobQuarantinePath: dest,
    blobQuarantineAt: meta.quarantinedAt,
    blobPurgeAfter: meta.purgeAfter,
    restoreEligible: true,
  };
  await asset.save();

  const filePreviewJob = require('./filePreviewJob.service');
  await filePreviewJob.purgePreviewArtifacts(asset._id).catch(() => {});

  await academicAuditService.recordAuditEvent({
    actorId: audit.actorId,
    entityType: 'file_asset',
    entityId: asset._id,
    action: 'blob_quarantined',
    severity: 'info',
    ip: audit.ip,
    metadata: { purgeAfter: meta.purgeAfter },
  }).catch(() => {});

  return { quarantined: true, path: dest, meta };
}

function getRestoreEligibility(asset) {
  if (!asset?.isDeleted && asset?.cleanupState === 'ACTIVE') {
    return { eligible: true, reason: 'active' };
  }
  const metaPath = quarantineMetaPath(asset._id);
  if (fs.existsSync(metaPath) && fs.existsSync(quarantinePathForAsset(asset._id))) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const expired = meta.purgeAfter && new Date(meta.purgeAfter) < new Date();
    return {
      eligible: !expired,
      reason: expired ? 'retention_expired' : 'quarantine_available',
      purgeAfter: meta.purgeAfter,
    };
  }
  return { eligible: false, reason: 'blob_purged_or_missing' };
}

/**
 * Restore physical blob from quarantine during retention window.
 */
async function restoreBlobFromQuarantine(asset, audit = {}) {
  const eligibility = getRestoreEligibility(asset);
  if (!eligibility.eligible) {
    const err = new Error(`Blob not restorable: ${eligibility.reason}`);
    err.statusCode = 410;
    throw err;
  }
  const qPath = quarantinePathForAsset(asset._id);
  const destRel = asset.storageKey || `academic/${asset.courseId || 'global'}/${asset.category}/${asset._id}${path.extname(asset.originalName || '')}`;
  const dest = path.join(paths.uploads, destRel.replace(/^\/uploads\//, ''));
  const destResolved = path.resolve(dest);
  if (!isPathInside(paths.uploads, destResolved)) {
    const err = new Error('Invalid restore destination');
    err.statusCode = 400;
    throw err;
  }
  fs.mkdirSync(path.dirname(destResolved), { recursive: true });
  fs.copyFileSync(qPath, destResolved);

  asset.isDeleted = false;
  asset.deletedAt = undefined;
  asset.cleanupState = 'ACTIVE';
  const meta = { ...(asset.metadata || {}) };
  delete meta.blobQuarantinePath;
  delete meta.blobQuarantineAt;
  delete meta.blobPurgeAfter;
  meta.restoreEligible = false;
  meta.blobRestoredAt = new Date().toISOString();
  asset.metadata = meta;
  asset.path = destRel;
  await asset.save();

  await academicAuditService.recordAuditEvent({
    actorId: audit.actorId,
    entityType: 'file_asset',
    entityId: asset._id,
    action: 'blob_restored_from_quarantine',
    severity: 'info',
    ip: audit.ip,
    metadata: { dest: destRel },
  }).catch(() => {});

  return asset;
}

/**
 * Nightly purge of quarantined blobs past retention (dry-run default).
 */
async function purgeExpiredQuarantineBlobs({ dryRun = true, limit = 500 } = {}) {
  ensureQuarantineDir();
  const retentionDays = await getBlobRetentionDays();
  const cutoff = Date.now() - retentionDays * 86400000;
  const files = fs.readdirSync(QUARANTINE_DIR).filter((f) => f.endsWith('.meta.json'));
  const report = { scanned: 0, purged: 0, dryRun, retentionDays };

  for (const metaFile of files.slice(0, limit)) {
    report.scanned += 1;
    const metaPath = path.join(QUARANTINE_DIR, metaFile);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const quarantinedAt = new Date(meta.quarantinedAt).getTime();
    if (quarantinedAt > cutoff && meta.purgeAfter && new Date(meta.purgeAfter) > new Date()) {
      continue;
    }
    const binPath = quarantinePathForAsset(meta.fileAssetId);
    if (!dryRun) {
      if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
      fs.unlinkSync(metaPath);
      await FileAsset.findByIdAndUpdate(meta.fileAssetId, {
        $set: {
          cleanupState: 'HARD_DELETED',
          'metadata.restoreEligible': false,
          'metadata.blobPurgedAt': new Date().toISOString(),
        },
      }).catch(() => {});
      await academicAuditService.recordAuditEvent({
        actorId: null,
        entityType: 'file_asset',
        entityId: meta.fileAssetId,
        action: 'blob_purge_completed',
        severity: 'info',
        metadata: { retentionDays },
      }).catch(() => {});
      report.purged += 1;
    } else {
      report.purged += 1;
    }
  }
  return report;
}

async function getRetentionMetrics() {
  ensureQuarantineDir();
  const metaFiles = fs.readdirSync(QUARANTINE_DIR).filter((f) => f.endsWith('.meta.json'));
  const eligible = await FileAsset.countDocuments({
    isDeleted: true,
    'metadata.restoreEligible': true,
  });
  return {
    quarantineBlobCount: metaFiles.length,
    restoreEligibleAssets: eligible,
    retentionDays: await getBlobRetentionDays(),
    quarantineDirBytes: metaFiles.length
      ? metaFiles.reduce((sum, f) => {
          const id = f.replace('.meta.json', '');
          const bin = quarantinePathForAsset(id);
          try {
            return sum + (fs.existsSync(bin) ? fs.statSync(bin).size : 0);
          } catch {
            return sum;
          }
        }, 0)
      : 0,
  };
}

async function verifyBlobRestoreParity(sampleLimit = 50) {
  const assets = await FileAsset.find({
    isDeleted: true,
    'metadata.restoreEligible': true,
  })
    .limit(sampleLimit)
    .lean();
  const issues = [];
  for (const a of assets) {
    const el = getRestoreEligibility(a);
    if (!el.eligible) issues.push({ id: a._id, reason: el.reason });
  }
  return { sampled: assets.length, issues, ok: issues.length === 0 };
}

/** Dry-run restore preview — no mutations (U48F). */
async function previewRestoreDryRun(fileAssetId) {
  const asset = await FileAsset.findById(fileAssetId).lean();
  if (!asset) {
    const err = new Error('File not found');
    err.statusCode = 404;
    throw err;
  }
  const eligibility = getRestoreEligibility(asset);
  const conflicts = [];
  if (asset.metadata?.legalHold) conflicts.push('legal_hold_active');
  if (asset.lifecycleLocked) conflicts.push('lifecycle_locked');
  const activeDup = await FileAsset.findOne({
    _id: { $ne: asset._id },
    storageKey: asset.storageKey,
    isDeleted: false,
  }).select('_id originalName');
  if (activeDup) {
    conflicts.push({ type: 'storage_key_collision', fileAssetId: String(activeDup._id) });
  }
  return {
    fileAssetId: String(asset._id),
    eligibility,
    conflicts,
    wouldRestoreBlob: eligibility.reason === 'quarantine_available',
    dryRun: true,
  };
}

module.exports = {
  QUARANTINE_DIR,
  getBlobRetentionDays,
  quarantineBlob,
  getRestoreEligibility,
  restoreBlobFromQuarantine,
  purgeExpiredQuarantineBlobs,
  getRetentionMetrics,
  verifyBlobRestoreParity,
  verifyQuarantineCopy,
  sha256File,
  previewRestoreDryRun,
};
