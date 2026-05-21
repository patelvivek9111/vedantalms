const FileAsset = require('../models/fileAsset.model');
const academicAuditService = require('./academicAudit.service');
const { readStoredContent } = require('./fileStorage.service');
const clamavAdapter = require('../adapters/scan/clamavAdapter');

const scanQueue = [];
let processing = false;

async function processScanQueue() {
  if (processing) return;
  processing = true;
  while (scanQueue.length) {
    const fileAssetId = scanQueue.shift();
    try {
      await runScan(fileAssetId);
    } catch (err) {
      console.error('[fileScan] scan failed', fileAssetId, err.message);
    }
  }
  processing = false;
}

async function runScan(fileAssetId, audit = {}) {
  const asset = await FileAsset.findById(fileAssetId);
  if (!asset) return null;

  asset.scanStatus = 'pending';
  asset.scanMeta = {
    ...(asset.scanMeta || {}),
    queuedAt: new Date().toISOString(),
    engine: clamavAdapter.isEnabled() ? 'clamav' : 'none',
  };
  await asset.save();

  let buffer = null;
  try {
    buffer = await readStoredContent(asset);
  } catch {
    asset.scanStatus = 'skipped';
    asset.scanMeta = { ...(asset.scanMeta || {}), skippedAt: new Date().toISOString(), reason: 'blob_unavailable' };
    await asset.save();
    return asset;
  }

  if (!buffer?.length) {
    await markFileClean(fileAssetId);
    return asset;
  }

  const result = await clamavAdapter.scanBuffer(buffer);
  if (result.clean) {
    return markFileClean(fileAssetId);
  }

  await markFileUnsafe(fileAssetId, result.signature || result.message || 'virus_detected', audit);
  await academicAuditService.recordAuditEvent({
    actorId: audit.actorId,
    entityType: 'file_asset',
    entityId: fileAssetId,
    action: 'file_virus_detected',
    severity: 'critical',
    ip: audit.ip,
    metadata: { engine: result.engine, message: result.message },
  }).catch(() => {});

  return FileAsset.findById(fileAssetId);
}

async function scanFile(fileAssetId, options = {}) {
  if (options.dryRun) {
    return {
      fileAssetId: String(fileAssetId),
      scanStatus: 'pending',
      message: 'Scan queued (dry run)',
    };
  }
  scanQueue.push(fileAssetId);
  setImmediate(() => processScanQueue());
  return {
    fileAssetId: String(fileAssetId),
    scanStatus: 'pending',
    message: 'Scan queued',
  };
}

async function queueFileScan(fileAssetId, options = {}) {
  const useEngine = clamavAdapter.isEnabled() && !options.dryRun;
  return scanFile(fileAssetId, { ...options, dryRun: !useEngine });
}

async function markFileUnsafe(fileAssetId, reason, audit = {}) {
  const asset = await FileAsset.findById(fileAssetId);
  if (!asset) {
    const err = new Error('File asset not found');
    err.statusCode = 404;
    throw err;
  }
  asset.scanStatus = 'unsafe';
  asset.scanMeta = {
    ...(asset.scanMeta || {}),
    unsafeAt: new Date().toISOString(),
    reason: reason || 'flagged_unsafe',
  };
  asset.lifecycleLocked = true;
  await asset.save();

  await academicAuditService.recordAuditEvent({
    actorId: audit.actorId,
    entityType: 'file_asset',
    entityId: asset._id,
    action: 'file_marked_unsafe',
    severity: 'critical',
    ip: audit.ip,
    requestId: audit.requestId,
    metadata: { reason },
  }).catch(() => {});

  return asset;
}

async function markFileClean(fileAssetId) {
  const asset = await FileAsset.findById(fileAssetId);
  if (!asset) return null;
  asset.scanStatus = 'clean';
  asset.scanMeta = { ...(asset.scanMeta || {}), cleanAt: new Date().toISOString() };
  await asset.save();
  return asset;
}

function assertSafeForAcademicUse(asset) {
  if (asset?.scanStatus === 'unsafe') {
    const err = new Error('File failed safety scan and cannot be used');
    err.statusCode = 403;
    throw err;
  }
  if (asset?.scanStatus === 'pending') {
    const err = new Error('File scan in progress — try again shortly');
    err.statusCode = 423;
    throw err;
  }
}

function assertSafeForDownload(asset) {
  assertSafeForAcademicUse(asset);
}

module.exports = {
  scanFile,
  queueFileScan,
  runScan,
  markFileUnsafe,
  markFileClean,
  assertSafeForAcademicUse,
  assertSafeForDownload,
};
