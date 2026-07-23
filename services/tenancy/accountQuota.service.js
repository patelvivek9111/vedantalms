const AccountQuota = require('../../models/accountQuota.model');
const User = require('../../models/user.model');
const AccountUser = require('../../models/accountUser.model');
const FileAsset = require('../../models/fileAsset.model');
const { getTenantRootAccountId } = require('../../utils/tenantContext');
const { incrWithExpire } = require('../../utils/cache');

async function ensureQuota(rootAccountId, { planCode } = {}) {
  if (!rootAccountId) {
    const err = new Error('rootAccountId is required for quotas');
    err.status = 400;
    throw err;
  }
  let doc = await AccountQuota.findOne({ rootAccountId });
  if (!doc) {
    const plan = planCode || 'standard';
    const defaults = AccountQuota.defaultsForPlan(plan);
    doc = await AccountQuota.create({
      rootAccountId,
      accountId: rootAccountId,
      planCode: plan,
      ...defaults,
    });
  }
  return doc;
}

async function getQuota(rootAccountId) {
  return ensureQuota(rootAccountId);
}

async function updateQuota(rootAccountId, patch = {}) {
  const doc = await ensureQuota(rootAccountId, { planCode: patch.planCode });
  const allowed = [
    'planCode',
    'maxSeats',
    'maxStorageBytes',
    'apiRateLimitPerMinute',
    'notes',
  ];
  for (const key of allowed) {
    if (patch[key] !== undefined) doc[key] = patch[key];
  }
  if (patch.planCode && !patch.maxSeats && !patch.maxStorageBytes) {
    const defaults = AccountQuota.defaultsForPlan(patch.planCode);
    doc.maxSeats = defaults.maxSeats;
    doc.maxStorageBytes = defaults.maxStorageBytes;
    doc.apiRateLimitPerMinute = defaults.apiRateLimitPerMinute;
  }
  await doc.save();
  return doc;
}

async function recountSeats(rootAccountId) {
  const membershipCount = await AccountUser.countDocuments({
    rootAccountId,
    workflowState: 'active',
  });
  const userCount = await User.countDocuments({
    rootAccountId,
    accountStatus: { $ne: 'suspended' },
  });
  const seatsUsed = Math.max(membershipCount, userCount);
  await AccountQuota.updateOne({ rootAccountId }, { $set: { seatsUsed } });
  return seatsUsed;
}

async function recountStorage(rootAccountId) {
  const [row] = await FileAsset.aggregate([
    { $match: { rootAccountId, isDeleted: false } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  const storageUsedBytes = row?.total || 0;
  await AccountQuota.updateOne({ rootAccountId }, { $set: { storageUsedBytes } });
  return storageUsedBytes;
}

async function assertSeatAvailable(rootAccountId, { additional = 1 } = {}) {
  const quota = await ensureQuota(rootAccountId);
  const used = await recountSeats(rootAccountId);
  if (used + additional > quota.maxSeats) {
    const err = new Error(
      `Seat quota exceeded (${used}/${quota.maxSeats}). Upgrade the institution plan.`
    );
    err.status = 403;
    err.statusCode = 403;
    err.code = 'SEAT_QUOTA_EXCEEDED';
    throw err;
  }
  return { used, maxSeats: quota.maxSeats };
}

async function assertStorageWithinQuota(rootAccountId, additionalBytes = 0) {
  if (!rootAccountId) return { allowed: true };
  const quota = await ensureQuota(rootAccountId);
  const used = await recountStorage(rootAccountId);
  if (used + additionalBytes > quota.maxStorageBytes) {
    const err = new Error('Institution storage quota exceeded');
    err.status = 413;
    err.statusCode = 413;
    err.code = 'TENANT_STORAGE_QUOTA_EXCEEDED';
    throw err;
  }
  return { used, maxStorageBytes: quota.maxStorageBytes };
}

/**
 * Per-tenant API rate limit. Falls back to allow when Redis unavailable.
 */
async function assertApiRateLimit(rootAccountId) {
  if (!rootAccountId) return { allowed: true, skipped: true };
  const quota = await ensureQuota(rootAccountId);
  const limit = quota.apiRateLimitPerMinute || 600;
  const minute = Math.floor(Date.now() / 60000);
  const key = `tenant:api:${rootAccountId}:${minute}`;
  const count = await incrWithExpire(key, 90);
  if (count == null) return { allowed: true, skipped: true };
  if (count > limit) {
    const err = new Error('Institution API rate limit exceeded');
    err.status = 429;
    err.statusCode = 429;
    err.code = 'TENANT_RATE_LIMIT';
    throw err;
  }
  return { allowed: true, count, limit };
}

function resolveRootAccountId(explicit) {
  return explicit || getTenantRootAccountId();
}

module.exports = {
  ensureQuota,
  getQuota,
  updateQuota,
  recountSeats,
  recountStorage,
  assertSeatAvailable,
  assertStorageWithinQuota,
  assertApiRateLimit,
  resolveRootAccountId,
};
