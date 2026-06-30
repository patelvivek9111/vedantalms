'use strict';

/**
 * Resolve MongoDB database name for scripts and server startup.
 * Prefers MONGO_DB_NAME / MONGODB_DB, then the path segment in MONGODB_URI, else fallback.
 */
function resolveMongoDbName(uri, fallback = 'lms') {
  const fromEnv = (process.env.MONGO_DB_NAME || process.env.MONGODB_DB || '').trim();
  if (fromEnv) return fromEnv;

  if (!uri || typeof uri !== 'string') return fallback;

  const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const parts = withoutProtocol.split('/');
  if (parts.length < 2) return fallback;

  const db = parts.slice(1).join('/').split('?')[0].trim();
  return db || fallback;
}

module.exports = { resolveMongoDbName };
