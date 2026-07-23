/**
 * In-memory cache of institution security policy from SystemSettings.
 * Keyed by rootAccountId (Canvas account settings).
 */

const DEFAULT_POLICY = {
  passwordMinLength: 8,
  requireStrongPassword: true,
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  enableTwoFactor: false,
  disablePublicRegistration: false,
  maintenanceMode: false,
};

/** @type {Map<string, object>} */
const cacheByRoot = new Map();
let legacyCachedPolicy = { ...DEFAULT_POLICY };
let cacheLoaded = false;

function policyFromSettings(settings) {
  return {
    passwordMinLength: settings.security?.passwordMinLength ?? DEFAULT_POLICY.passwordMinLength,
    requireStrongPassword: settings.security?.requireStrongPassword !== false,
    sessionTimeout: settings.security?.sessionTimeout ?? DEFAULT_POLICY.sessionTimeout,
    maxLoginAttempts: settings.security?.maxLoginAttempts ?? DEFAULT_POLICY.maxLoginAttempts,
    enableTwoFactor: Boolean(settings.security?.enableTwoFactor),
    disablePublicRegistration: Boolean(settings.security?.disablePublicRegistration),
    maintenanceMode: Boolean(settings.general?.maintenanceMode),
  };
}

async function refreshSecurityPolicyCache(rootAccountId) {
  try {
    const SystemSettings = require('../models/systemSettings.model');
    const settings = await SystemSettings.getSettings(rootAccountId);
    const policy = policyFromSettings(settings);
    if (rootAccountId) {
      cacheByRoot.set(String(rootAccountId), policy);
    } else {
      legacyCachedPolicy = policy;
    }
    cacheLoaded = true;
    return policy;
  } catch (err) {
    console.warn('securityPolicy cache refresh failed', err?.message || err);
  }
  return rootAccountId
    ? cacheByRoot.get(String(rootAccountId)) || { ...DEFAULT_POLICY }
    : legacyCachedPolicy;
}

function getSecurityPolicy(rootAccountId) {
  const { getTenantRootAccountId } = require('../utils/tenantContext');
  const id = rootAccountId || getTenantRootAccountId();
  if (id) {
    const key = String(id);
    if (!cacheByRoot.has(key)) {
      void refreshSecurityPolicyCache(id);
      return cacheByRoot.get(key) || { ...DEFAULT_POLICY };
    }
    return cacheByRoot.get(key);
  }
  if (!cacheLoaded) {
    void refreshSecurityPolicyCache();
  }
  return legacyCachedPolicy;
}

function isPublicRegistrationDisabled(rootAccountId) {
  if (process.env.DISABLE_PUBLIC_REGISTRATION === 'true') return true;
  return Boolean(getSecurityPolicy(rootAccountId).disablePublicRegistration);
}

module.exports = {
  DEFAULT_POLICY,
  refreshSecurityPolicyCache,
  getSecurityPolicy,
  isPublicRegistrationDisabled,
};
