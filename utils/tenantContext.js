const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

/**
 * @typedef {object} TenantContext
 * @property {import('mongoose').Types.ObjectId|string} rootAccountId
 * @property {import('mongoose').Types.ObjectId|string} [accountId]
 * @property {string} [host]
 * @property {boolean} [isPlatformAdmin]
 */

function runWithTenant(context, fn) {
  return tenantStorage.run(context || {}, fn);
}

function getTenantContext() {
  return tenantStorage.getStore() || null;
}

function getTenantRootAccountId() {
  const ctx = getTenantContext();
  return ctx?.rootAccountId || null;
}

function setRequestTenant(req, context) {
  req.rootAccountId = context?.rootAccountId || null;
  req.accountId = context?.accountId || context?.rootAccountId || null;
  req.account = context?.account || null;
  req.tenantHost = context?.host || null;
  req.isPlatformAdmin = Boolean(context?.isPlatformAdmin);
}

/**
 * Merge tenant scope into a Mongo filter. Platform admins may omit scope when
 * explicitly targeting another account via req.accountId / header.
 */
function withTenantFilter(filter = {}, rootAccountId, { allowUnscoped = false } = {}) {
  const next = { ...(filter || {}) };
  if (!rootAccountId) {
    if (allowUnscoped) return next;
    // Force empty match rather than leaking all tenants
    next.rootAccountId = null;
    return next;
  }
  if (next.rootAccountId == null) {
    next.rootAccountId = rootAccountId;
  }
  return next;
}

function rootAccountIdFromRequest(req) {
  if (req?.rootAccountId) return req.rootAccountId;
  if (req?.user?.rootAccountId) return req.user.rootAccountId;
  return getTenantRootAccountId();
}

module.exports = {
  tenantStorage,
  runWithTenant,
  getTenantContext,
  getTenantRootAccountId,
  setRequestTenant,
  withTenantFilter,
  rootAccountIdFromRequest,
};
