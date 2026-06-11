const academicAuditService = require('./academicAudit.service');
const { incrWithExpire, getRedisClient } = require('../utils/cache');

const downloadCounts = new Map();
const streamCounts = new Map();
const WINDOW_MS = 60 * 1000;
const WINDOW_SEC = 60;
const DEFAULT_MAX_PER_WINDOW = parseInt(process.env.FILE_DOWNLOAD_RATE_LIMIT || '60', 10);
const DEFAULT_STREAM_MAX_PER_WINDOW = parseInt(process.env.FILE_STREAM_RATE_LIMIT || '120', 10);

function rateLimitKey(userId, fileAssetId) {
  return `${userId}:${fileAssetId}`;
}

function redisRateLimitKey(action, userId, fileAssetId) {
  return `file:${action}:${userId}:${fileAssetId}`;
}

async function assertRateLimitInMap(counts, user, fileAssetId, maxPerWindow, action, audit = {}) {
  if (!user?._id) return;

  const redisKey = redisRateLimitKey(action, user._id, fileAssetId);
  if (getRedisClient()) {
    const count = await incrWithExpire(redisKey, WINDOW_SEC);
    if (count !== null && count > maxPerWindow) {
      await academicAuditService.recordAuditEvent({
        actorId: user._id,
        entityType: 'file_asset',
        entityId: fileAssetId,
        action,
        severity: 'critical',
        ip: audit.ip,
        metadata: { count, windowMs: WINDOW_MS, maxPerWindow, backend: 'redis' },
      }).catch(() => {});
      const err = new Error('File access rate limit exceeded');
      err.statusCode = 429;
      throw err;
    }
    return;
  }

  const key = rateLimitKey(user._id, fileAssetId);
  const now = Date.now();
  let bucket = counts.get(key);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    bucket = { start: now, count: 0 };
    counts.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > maxPerWindow) {
    await academicAuditService.recordAuditEvent({
      actorId: user._id,
      entityType: 'file_asset',
      entityId: fileAssetId,
      action,
      severity: 'critical',
      ip: audit.ip,
      metadata: { count: bucket.count, windowMs: WINDOW_MS, maxPerWindow, backend: 'memory' },
    }).catch(() => {});
    const err = new Error('File access rate limit exceeded');
    err.statusCode = 429;
    throw err;
  }
}

/**
 * Per-user per-file download rate limit (U35F).
 */
async function assertDownloadRateLimit(user, fileAssetId, audit = {}) {
  return assertRateLimitInMap(
    downloadCounts,
    user,
    fileAssetId,
    DEFAULT_MAX_PER_WINDOW,
    'suspicious_mass_download',
    audit
  );
}

/**
 * Per-user per-file stream/preview rate limit (lighter cap than bulk download).
 */
async function assertStreamRateLimit(user, fileAssetId, audit = {}) {
  return assertRateLimitInMap(
    streamCounts,
    user,
    fileAssetId,
    DEFAULT_STREAM_MAX_PER_WINDOW,
    'suspicious_mass_stream',
    audit
  );
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
  assertStreamRateLimit,
  recordGeographicAccess,
  createExpiringShareLink,
  revokeTemporaryAccess,
  attachWatermarkMetadata,
};
