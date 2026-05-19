const { getBullmqConnection, isRedisConfigured } = require('../../utils/bullmqConnection');

/**
 * Redis cache adapter — shared connection with BullMQ when configured.
 */
class RedisCacheAdapter {
  constructor() {
    this.name = 'redis';
  }

  getClient() {
    return getBullmqConnection();
  }

  isAvailable() {
    return isRedisConfigured() && Boolean(this.getClient());
  }

  async get(key) {
    const client = this.getClient();
    if (!client) return null;
    try {
      return await client.get(key);
    } catch {
      return null;
    }
  }

  async set(key, value, ttlSec) {
    const client = this.getClient();
    if (!client) return;
    try {
      if (ttlSec) await client.setex(key, ttlSec, value);
      else await client.set(key, value);
    } catch {
      /* ignore */
    }
  }

  async del(key) {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.del(key);
    } catch {
      /* ignore */
    }
  }

  async keys(pattern) {
    const client = this.getClient();
    if (!client) return [];
    try {
      return await client.keys(pattern);
    } catch {
      return [];
    }
  }

  getCapabilities() {
    return { supportsDistributedLocks: true, supportsTTL: true };
  }
}

module.exports = { RedisCacheAdapter };
