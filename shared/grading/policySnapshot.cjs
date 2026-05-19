const crypto = require('crypto');

/** Keys stripped before canonical serialization / hashing. */
const VOLATILE_KEYS = new Set([
  '__v',
  '_id',
  'createdAt',
  'updatedAt',
  'updatedBy',
  'computedAt',
  'timestamp',
]);

/**
 * Deep-sort object keys for deterministic JSON serialization.
 * @param {unknown} value
 * @returns {unknown}
 */
function sortKeysDeep(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    if (VOLATILE_KEYS.has(key)) continue;
    sorted[key] = sortKeysDeep(value[key]);
  }
  return sorted;
}

/**
 * Plain JSON-safe resolved policy (no functions, dates, or class instances).
 * @param {object} policy
 * @returns {object}
 */
function toPlainPolicy(policy) {
  return JSON.parse(JSON.stringify(policy || {}));
}

/**
 * Canonical stable string for hashing (key-order independent).
 * @param {object} policy
 * @returns {string}
 */
function stableStringifyPolicy(policy) {
  return JSON.stringify(sortKeysDeep(toPlainPolicy(policy)));
}

/**
 * SHA-256 hex digest of canonical policy representation.
 * @param {object} policy
 * @returns {string}
 */
function hashResolvedPolicy(policy) {
  return crypto.createHash('sha256').update(stableStringifyPolicy(policy)).digest('hex');
}

/**
 * Extract policy version from resolved policy metadata.
 * @param {object} resolved
 * @returns {number}
 */
function extractPolicyVersion(resolved) {
  const v =
    resolved?._meta?.policyVersion ??
    resolved?.version ??
  1;
  return typeof v === 'number' && !Number.isNaN(v) ? v : 1;
}

/**
 * Build immutable snapshot bundle from fully resolved policy.
 * @param {object} resolved - output of resolveGradingPolicy()
 * @returns {{ policyVersion: number, policyHash: string, resolvedPolicySnapshot: object }}
 */
function generateResolvedPolicySnapshot(resolved) {
  const plain = toPlainPolicy(resolved);
  const policyVersion = extractPolicyVersion(plain);
  const policyHash = hashResolvedPolicy(plain);
  return {
    policyVersion,
    policyHash,
    resolvedPolicySnapshot: plain,
  };
}

/**
 * Rehydrate resolved policy from a stored snapshot for calculator use.
 * @param {object} storedSnapshot
 * @returns {object|null}
 */
function resolvedPolicyFromSnapshot(storedSnapshot) {
  if (!storedSnapshot || typeof storedSnapshot !== 'object') return null;
  return toPlainPolicy(storedSnapshot);
}

module.exports = {
  stableStringifyPolicy,
  hashResolvedPolicy,
  generateResolvedPolicySnapshot,
  extractPolicyVersion,
  resolvedPolicyFromSnapshot,
  sortKeysDeep,
  toPlainPolicy,
};
