import crypto from 'node:crypto';

const VOLATILE_KEYS = new Set([
  '__v',
  '_id',
  'createdAt',
  'updatedAt',
  'updatedBy',
  'computedAt',
  'timestamp',
]);

export function sortKeysDeep(value) {
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

export function toPlainPolicy(policy) {
  return JSON.parse(JSON.stringify(policy || {}));
}

export function stableStringifyPolicy(policy) {
  return JSON.stringify(sortKeysDeep(toPlainPolicy(policy)));
}

export function hashResolvedPolicy(policy) {
  return crypto.createHash('sha256').update(stableStringifyPolicy(policy)).digest('hex');
}

export function extractPolicyVersion(resolved) {
  const v = resolved?._meta?.policyVersion ?? resolved?.version ?? 1;
  return typeof v === 'number' && !Number.isNaN(v) ? v : 1;
}

export function generateResolvedPolicySnapshot(resolved) {
  const plain = toPlainPolicy(resolved);
  const policyVersion = extractPolicyVersion(plain);
  const policyHash = hashResolvedPolicy(plain);
  return {
    policyVersion,
    policyHash,
    resolvedPolicySnapshot: plain,
  };
}

export function resolvedPolicyFromSnapshot(storedSnapshot) {
  if (!storedSnapshot || typeof storedSnapshot !== 'object') return null;
  return toPlainPolicy(storedSnapshot);
}
