/**
 * Request cache and deduplication utility
 * Prevents duplicate API calls when multiple components request the same data
 */

interface CachedRequest<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

class RequestCache {
  private cache: Map<string, CachedRequest<any>> = new Map();
  private readonly DEFAULT_TTL = 30000; // 30 seconds default TTL

  /**
   * Get cached data or execute request
   */
  async get<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // If we have valid cached data, return it
    if (cached && (now - cached.timestamp) < ttl) {
      return cached.data;
    }

    // If there's an ongoing request, wait for it
    if (cached?.promise) {
      return cached.promise;
    }

    // Create new request
    const promise = requestFn()
      .then((data) => {
        this.cache.set(key, {
          data,
          timestamp: now,
        });
        return data;
      })
      .catch((error) => {
        // Remove failed request from cache
        const current = this.cache.get(key);
        if (current?.promise === promise) {
          this.cache.delete(key);
        }
        throw error;
      });

    // Store promise while request is in flight
    this.cache.set(key, {
      data: cached?.data, // Keep old data while fetching
      timestamp: cached?.timestamp || now,
      promise,
    });

    return promise;
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(key: string) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const requestCache = new RequestCache();

// Predefined cache keys
export const CACHE_KEYS = {
  USER_PREFERENCES: 'user:preferences',
  INBOX_CONVERSATIONS: 'inbox:conversations',
  COURSES: 'courses',
  UNREAD_COUNT: 'inbox:unread-count',
  NOTIFICATION_COUNT: 'notifications:unread-count',
  NOTIFICATIONS: 'notifications:list',
} as const;



