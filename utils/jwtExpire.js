/**
 * Resolve JWT / auth-cookie lifetime.
 * Canvas-style: account sessionTimeout (minutes) wins when set; else JWT_EXPIRE env.
 */
function parseExpireToMs(raw) {
  const match = /^(\d+)([dhms])$/.exec(String(raw || '').trim());
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return n * (multipliers[match[2]] || 86400000);
}

function resolveJwtExpireString(rootAccountId) {
  try {
    const { getSecurityPolicy } = require('../services/securityPolicy.service');
    const policy = getSecurityPolicy(rootAccountId);
    const minutes = Number(policy?.sessionTimeout);
    if (Number.isFinite(minutes) && minutes > 0) {
      return `${Math.max(5, Math.min(minutes, 60 * 24 * 30))}m`;
    }
  } catch {
    /* fall through */
  }
  return process.env.JWT_EXPIRE || '7d';
}

function resolveJwtExpireMs(rootAccountId) {
  return parseExpireToMs(resolveJwtExpireString(rootAccountId)) || 7 * 24 * 60 * 60 * 1000;
}

module.exports = {
  resolveJwtExpireString,
  resolveJwtExpireMs,
  parseExpireToMs,
};
