/**
 * In-process cache fallback (dev / no Redis).
 */
class MemoryCacheAdapter {
  constructor() {
    this.name = 'memory';
    this.store = new Map();
    this.expiry = new Map();
  }

  async get(key) {
    const exp = this.expiry.get(key);
    if (exp && Date.now() > exp) {
      this.store.delete(key);
      this.expiry.delete(key);
      return null;
    }
    return this.store.get(key) ?? null;
  }

  async set(key, value, ttlSec) {
    this.store.set(key, value);
    if (ttlSec != null && ttlSec >= 0) {
      this.expiry.set(key, Date.now() + Math.max(0, ttlSec) * 1000);
    }
  }

  async del(key) {
    this.store.delete(key);
    this.expiry.delete(key);
  }

  async keys(pattern) {
    const prefix = pattern.replace(/\*/g, '');
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }

  getCapabilities() {
    return { supportsDistributedLocks: false, supportsTTL: true };
  }
}

module.exports = { MemoryCacheAdapter };
