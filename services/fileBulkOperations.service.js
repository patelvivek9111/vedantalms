const fs = require('fs');
const path = require('path');
const FileAsset = require('../models/fileAsset.model');
const academicAuditService = require('./academicAudit.service');
const fileRecoveryCenter = require('./fileRecoveryCenter.service');
const { ADMIN_ROLES } = require('../middleware/academicPermissions');
const { paths } = require('../config/paths');
const { createReadStreamForAsset } = require('./fileStorage.service');

function assertBulkAdmin(user) {
  if (!user || !ADMIN_ROLES.has(user.role)) {
    const err = new Error('Admin required for bulk file operations');
    err.statusCode = 403;
    throw err;
  }
}

async function bulkZipExport(fileAssetIds, user, audit = {}) {
  assertBulkAdmin(user);
  const assets = await FileAsset.find({ _id: { $in: fileAssetIds }, isDeleted: false });
  const bundleId = `bulk-${Date.now()}`;
  const bundleDir = path.join(paths.uploads, 'exports', 'bulk', bundleId);
  fs.mkdirSync(bundleDir, { recursive: true });
  const manifest = [];

  for (const asset of assets) {
    const stream = createReadStreamForAsset(asset);
    const name = asset.originalName || `${asset._id}`;
    if (!stream) {
      manifest.push({ fileAssetId: String(asset._id), name, included: false, reason: 'blob_missing' });
      continue;
    }
    const dest = path.join(bundleDir, `${asset._id}-${name}`);
    fs.copyFileSync(stream.path, dest);
    manifest.push({ fileAssetId: String(asset._id), name, included: true, path: dest });
  }
  fs.writeFileSync(path.join(bundleDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: 'bulk',
    action: 'file_bulk_zip_export',
    metadata: { count: assets.length, bundleDir },
    ip: audit.ip,
  }).catch(() => {});

  return { bundleDir, manifest, count: assets.length };
}

async function bulkRestore(fileAssetIds, user, audit = {}) {
  assertBulkAdmin(user);
  const results = [];
  for (const id of fileAssetIds) {
    try {
      const asset = await fileRecoveryCenter.restoreDeletedFile(id, user, audit);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }
  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: 'bulk',
    action: 'file_bulk_restore',
    metadata: { results },
    ip: audit.ip,
  }).catch(() => {});
  return results;
}

async function bulkQuarantine(fileAssetIds, reason, user, audit = {}) {
  assertBulkAdmin(user);
  const results = [];
  for (const id of fileAssetIds) {
    try {
      await fileRecoveryCenter.quarantineFile(id, reason, user, audit);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }
  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: 'bulk',
    action: 'file_bulk_quarantine',
    metadata: { count: results.filter((r) => r.ok).length },
    ip: audit.ip,
  }).catch(() => {});
  return results;
}

async function bulkRelease(fileAssetIds, user, audit = {}) {
  assertBulkAdmin(user);
  const results = [];
  for (const id of fileAssetIds) {
    try {
      await fileRecoveryCenter.releaseQuarantine(id, user, audit);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }
  return results;
}

async function bulkMarkRetention(fileAssetIds, user, audit = {}) {
  assertBulkAdmin(user);
  await FileAsset.updateMany(
    { _id: { $in: fileAssetIds } },
    { $set: { cleanupState: 'PENDING_DELETE', 'metadata.retentionMarkedAt': new Date().toISOString() } }
  );
  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: 'bulk',
    action: 'file_bulk_retention_mark',
    metadata: { count: fileAssetIds.length },
    ip: audit.ip,
  }).catch(() => {});
  return { marked: fileAssetIds.length };
}

module.exports = {
  bulkZipExport,
  bulkRestore,
  bulkQuarantine,
  bulkRelease,
  bulkMarkRetention,
};
