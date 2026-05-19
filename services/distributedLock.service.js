const crypto = require('crypto');
const { getCacheService } = require('./cache');

const memoryLocks = new Map();

async function acquireLock(key, ttlMs = 120000) {
  const lockKey = `lock:${key}`;
  const token = crypto.randomBytes(16).toString('hex');
  const cache = getCacheService();

  if (cache.provider === 'redis' && cache.adapter.isAvailable?.()) {
    const redis = cache.adapter.getClient();
    if (redis) {
      const result = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return {
          key: lockKey,
          token,
          release: async () => {
            const script =
              'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
            await redis.eval(script, 1, lockKey, token);
          },
        };
      }
      return null;
    }
  }

  const now = Date.now();
  const existing = memoryLocks.get(lockKey);
  if (existing && existing.expiresAt > now) return null;
  memoryLocks.set(lockKey, { token, expiresAt: now + ttlMs });
  return {
    key: lockKey,
    token,
    release: async () => {
      const cur = memoryLocks.get(lockKey);
      if (cur && cur.token === token) memoryLocks.delete(lockKey);
    },
  };
}

async function withLock(key, fn, ttlMs = 120000) {
  const lock = await acquireLock(key, ttlMs);
  if (!lock) {
    const err = new Error('Resource is locked; retry later');
    err.statusCode = 409;
    err.code = 'LOCK_NOT_ACQUIRED';
    throw err;
  }
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

module.exports = { acquireLock, withLock };
