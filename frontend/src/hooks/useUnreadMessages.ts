import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchConversations } from '../services/inboxService';
import logger from '../utils/logger';
import { requestCache, CACHE_KEYS } from '../utils/requestCache';

/**
 * Singleton manager for unread messages
 * This ensures only one polling instance exists, even if multiple components use the hook
 */
class UnreadMessagesManager {
  private unreadCount: number = 0;
  private loading: boolean = true;
  private subscribers: Set<(count: number, loading: boolean) => void> = new Set();
  private isFetching: boolean = false;
  private pollInterval: number = 90000; // Start with 90 seconds (increased from 60)
  private intervalId: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  private isTabVisible: boolean = true;

  constructor() {
    // Listen for tab visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = () => {
    this.isTabVisible = !document.hidden;
    
    if (this.isTabVisible) {
      // Tab became visible - resume polling if needed
      if (!this.intervalId) {
        this.startPolling();
      }
      // Immediately fetch to get latest count
      this.fetchUnreadCount();
    } else {
      // Tab hidden - pause polling to save resources
      this.stopPolling();
    }
  };

  subscribe(callback: (count: number, loading: boolean) => void) {
    this.subscribers.add(callback);
    // Immediately notify with current state
    callback(this.unreadCount, this.loading);
    
    // Start polling if this is the first subscriber
    if (this.subscribers.size === 1) {
      this.fetchUnreadCount();
      this.startPolling();
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      // Stop polling if no more subscribers
      if (this.subscribers.size === 0) {
        this.stopPolling();
      }
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => {
      callback(this.unreadCount, this.loading);
    });
  }

  private fetchUnreadCount = async (isRetry = false) => {
    // Don't fetch if tab is hidden (unless it's a retry)
    if (!this.isTabVisible && !isRetry) {
      return;
    }

    // Prevent concurrent requests
    if (this.isFetching && !isRetry) {
      return;
    }

    try {
      this.isFetching = true;
      if (!isRetry) {
        this.loading = true;
        this.notifySubscribers();
      }

      // Use request cache with increased TTL (60 seconds instead of 30)
      const conversations = await requestCache.get(
        CACHE_KEYS.INBOX_CONVERSATIONS,
        () => fetchConversations(),
        60000 // Cache for 60 seconds (increased from 30)
      );

      // Ensure conversations is an array before calling reduce
      const conversationsArray = Array.isArray(conversations) ? conversations : [];
      const totalUnread = conversationsArray.reduce((sum: number, conv: any) => sum + (conv.unreadCount || 0), 0);
      
      this.unreadCount = totalUnread;
      this.loading = false;
      this.notifySubscribers();
      
      // Reset poll interval on success
      this.pollInterval = 90000; // Back to normal 90 seconds
      
      // Restart polling if it was stopped due to rate limiting
      if (!this.intervalId && this.isTabVisible) {
        this.startPolling();
      }
    } catch (error: any) {
      // Check if it's a rate limit error (429)
      const isRateLimit = error?.response?.status === 429;
      
      if (isRateLimit) {
        // Use retry-after from error (set by API interceptor) or fallback to exponential backoff
        const retryAfterSeconds = error?.retryAfter || error?.retryAfterSeconds;
        const backoffDelay = retryAfterSeconds 
          ? retryAfterSeconds * 1000 // Convert seconds to milliseconds
          : Math.min(this.pollInterval * 2, 300000); // Fallback: exponential backoff, max 5 minutes
        
        // Update poll interval to respect retry-after, but don't make it too long
        this.pollInterval = Math.min(backoffDelay, 300000); // Cap at 5 minutes
        
        logger.warn('Rate limited when fetching unread messages', {
          retryAfter: retryAfterSeconds || Math.floor(backoffDelay / 1000),
          retryAfterSeconds: retryAfterSeconds || Math.floor(backoffDelay / 1000),
          backoffDelayMs: backoffDelay,
          message: error?.response?.data?.message || 'Too many requests'
        });
        
        // Clear existing interval and retry timeout
        this.stopPolling();
        if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
        }
        
        // Schedule a retry after the retry-after delay
        this.retryTimeout = setTimeout(() => {
          this.fetchUnreadCount(true);
        }, backoffDelay);
      } else {
        logger.error('Error fetching unread messages', error instanceof Error ? error : undefined, error instanceof Error ? undefined : { error });
      }
      
      this.loading = false;
      this.notifySubscribers();
      // Don't reset count to 0 on error - keep the last known count
    } finally {
      this.isFetching = false;
    }
  };

  private startPolling() {
    // Don't start if tab is hidden
    if (!this.isTabVisible) {
      return;
    }

    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    // Set up polling with current interval
    this.intervalId = setInterval(() => {
      if (!this.isFetching && this.isTabVisible) {
        this.fetchUnreadCount();
      }
    }, this.pollInterval);
  }

  private stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  refresh() {
    this.fetchUnreadCount();
  }

  getUnreadCount() {
    return this.unreadCount;
  }

  getLoading() {
    return this.loading;
  }

  destroy() {
    this.stopPolling();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.subscribers.clear();
  }
}

// Singleton instance
const unreadMessagesManager = new UnreadMessagesManager();

/**
 * Hook to get unread messages count
 * Uses singleton pattern to ensure only one polling instance exists
 * even if multiple components use this hook
 */
export const useUnreadMessages = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to the singleton manager
    const unsubscribe = unreadMessagesManager.subscribe((count, isLoading) => {
      setUnreadCount(count);
      setLoading(isLoading);
    });
    
    // Listen for inbox message read events
    const handleInboxMessageRead = () => {
      // Refresh unread count when a message is read
      unreadMessagesManager.refresh();
    };
    
    window.addEventListener('inboxMessageRead', handleInboxMessageRead);
    
    return () => {
      unsubscribe();
      window.removeEventListener('inboxMessageRead', handleInboxMessageRead);
    };
  }, []);

  const refreshUnreadCount = useCallback(() => {
    unreadMessagesManager.refresh();
  }, []);

  return { unreadCount, loading, refreshUnreadCount };
};
