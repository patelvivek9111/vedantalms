/**
 * Optional dedicated DB / Redis prefix map per root account (Canvas shard stub).
 * Runtime still uses primary MONGODB_URI until a mapping is configured.
 */

const DEFAULT_SHARD = {
  mongoUriEnvKey: 'MONGODB_URI',
  redisKeyPrefix: 'lms',
  label: 'primary',
};

/** @type {Record<string, { mongoUriEnvKey?: string, redisKeyPrefix?: string, label?: string }>} */
const BY_ACCOUNT_CODE = {
  // Example: HUGECUST: { mongoUriEnvKey: 'MONGODB_URI_HUGECUST', redisKeyPrefix: 'lms:hugecust', label: 'shard-a' },
};

function resolveShardForRoot({ rootAccountId, accountCode } = {}) {
  const code = accountCode ? String(accountCode).toUpperCase() : null;
  const mapped = (code && BY_ACCOUNT_CODE[code]) || null;
  return {
    rootAccountId: rootAccountId ? String(rootAccountId) : null,
    accountCode: code,
    ...(mapped || DEFAULT_SHARD),
    mongoUri: process.env[(mapped || DEFAULT_SHARD).mongoUriEnvKey] || process.env.MONGODB_URI || null,
    isDedicated: Boolean(mapped),
  };
}

module.exports = {
  DEFAULT_SHARD,
  BY_ACCOUNT_CODE,
  resolveShardForRoot,
};
