const { resolveCacheProvider } = require('../../config/providers');
const { RedisCacheAdapter } = require('../../adapters/cache/redisCacheAdapter');
const { MemoryCacheAdapter } = require('../../adapters/cache/memoryCacheAdapter');

let cacheInstance = null;

function createCacheAdapter(providerKey) {
  if (providerKey === 'redis') return new RedisCacheAdapter();
  return new MemoryCacheAdapter();
}

function getCacheService() {
  if (!cacheInstance) {
    const provider = resolveCacheProvider();
    const adapter = createCacheAdapter(provider);
    cacheInstance = {
      provider,
      adapter,
      async getJson(key) {
        const raw = await adapter.get(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      },
      async setJson(key, value, ttlSec) {
        await adapter.set(key, JSON.stringify(value), ttlSec);
      },
      get: (key) => adapter.get(key),
      set: (key, val, ttl) => adapter.set(key, val, ttl),
      del: (key) => adapter.del(key),
      keys: (pattern) => adapter.keys(pattern),
      getCapabilities: () => adapter.getCapabilities?.() || {},
    };
  }
  return cacheInstance;
}

module.exports = {
  getCacheService,
  createCacheAdapter,
};
