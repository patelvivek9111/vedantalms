/**
 * In-memory cache of institution security policy from SystemSettings.
 * Refreshed on startup and after admin settings updates.
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

let cachedPolicy = { ...DEFAULT_POLICY };
let cacheLoaded = false;

async function refreshSecurityPolicyCache() {
  try {
    const SystemSettings = require('../models/systemSettings.model');
    const settings = await SystemSettings.getSettings();
    cachedPolicy = {
      passwordMinLength: settings.security?.passwordMinLength ?? DEFAULT_POLICY.passwordMinLength,
      requireStrongPassword: settings.security?.requireStrongPassword !== false,
      sessionTimeout: settings.security?.sessionTimeout ?? DEFAULT_POLICY.sessionTimeout,
      maxLoginAttempts: settings.security?.maxLoginAttempts ?? DEFAULT_POLICY.maxLoginAttempts,
      enableTwoFactor: Boolean(settings.security?.enableTwoFactor),
      disablePublicRegistration: Boolean(settings.security?.disablePublicRegistration),
      maintenanceMode: Boolean(settings.general?.maintenanceMode),
    };
    cacheLoaded = true;
  } catch (err) {
    console.warn('securityPolicy cache refresh failed', err?.message || err);
  }
  return cachedPolicy;
}

function getSecurityPolicy() {
  if (!cacheLoaded) {
    void refreshSecurityPolicyCache();
  }
  return cachedPolicy;
}

function isPublicRegistrationDisabled() {
  if (process.env.DISABLE_PUBLIC_REGISTRATION === 'true') return true;
  return Boolean(getSecurityPolicy().disablePublicRegistration);
}

module.exports = {
  DEFAULT_POLICY,
  refreshSecurityPolicyCache,
  getSecurityPolicy,
  isPublicRegistrationDisabled,
};
