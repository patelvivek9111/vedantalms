const SystemAuditEvent = require('../models/systemAuditEvent.model');
const academicAuditService = require('./academicAudit.service');

const downloadCounts = new Map();
const WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_PER_WINDOW = parseInt(process.env.FILE_DOWNLOAD_RATE_LIMIT || '60', 10);

function rateLimitKey(userId, fileAssetId) {
  return `${userId}:${fileAssetId}`;
}

/**
 * Per-user per-file download rate limit (U35F).
 */
async function assertDownloadRateLimit(user, fileAssetId, audit = {}) {
  if (!user?._id) return;
  const key = rateLimitKey(user._id, fileAssetId);
  const now = Date.now();
  let bucket = downloadCounts.get(key);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    bucket = { start: now, count: 0 };
    downloadCounts.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > DEFAULT_MAX_PER_WINDOW) {
    await academicAuditService.recordAuditEvent({
      actorId: user._id,
      entityType: 'file_asset',
      entityId: fileAssetId,
      action: 'suspicious_mass_download',
      severity: 'critical',
      ip: audit.ip,
      metadata: { count: bucket.count, windowMs: WINDOW_MS },
    }).catch(() => {});
    const err = new Error('Download rate limit exceeded');
    err.statusCode = 429;
    throw err;
  }
}

/**
 * Log geographic metadata when country header present (configurable).
 */
async function recordGeographicAccess(user, fileAssetId, req = {}) {
  const country = req.headers?.['cf-ipcountry'] || req.headers?.['x-country-code'];
  if (!country || country === 'XX') return;
  const allowed = (process.env.FILE_ALLOWED_COUNTRIES || '').split(',').filter(Boolean);
  if (!allowed.length) return;
  if (!allowed.includes(country)) {
    await academicAuditService.recordAuditEvent({
      actorId: user?._id,
      entityType: 'file_asset',
      entityId: fileAssetId,
      action: 'geographic_access_anomaly',
      severity: 'warning',
      ip: req.ip,
      metadata: { country, allowed },
    }).catch(() => {});
  }
}

async function createExpiringShareLink(fileAssetId, user, { expiresInMinutes = 60 } = {}) {
  const fileAccessService = require('./fileAccess.service');
  const { token, expiresAt } = fileAccessService.createFileDownloadToken(fileAssetId, user._id, {
    ttlSeconds: expiresInMinutes * 60,
  });
  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: fileAssetId,
    action: 'file_share_created',
    metadata: { expiresAt },
  }).catch(() => {});
  return { token, expiresAt, path: `/api/files/${fileAssetId}/download?token=${encodeURIComponent(token)}` };
}

async function revokeTemporaryAccess(fileAssetId, user, audit = {}) {
  await academicAuditService.recordAuditEvent({
    actorId: user._id,
    entityType: 'file_asset',
    entityId: fileAssetId,
    action: 'temporary_access_revoked',
    ip: audit.ip,
  }).catch(() => {});
  return { revoked: true, fileAssetId };
}

function attachWatermarkMetadata(asset, user) {
  return {
    ...(asset.metadata || {}),
    downloadWatermark: {
      userId: String(user._id),
      at: new Date().toISOString(),
    },
  };
}

module.exports = {
  assertDownloadRateLimit,
  recordGeographicAccess,
  createExpiringShareLink,
  revokeTemporaryAccess,
  attachWatermarkMetadata,
};
