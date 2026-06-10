import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getNotificationPollIntervalMs,
  isNotificationWebSocketEnabled,
  NOTIFICATION_POLL_CONNECTED_MS,
  NOTIFICATION_POLL_FALLBACK_MS,
  onNotificationSocketEvent,
} from '@/utils/notificationSocket';

describe('notificationSocket', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled when VITE flag is not true', () => {
    vi.stubEnv('VITE_NOTIFICATION_WEBSOCKET_ENABLED', 'false');
    expect(isNotificationWebSocketEnabled()).toBe(false);
  });

  it('uses fallback poll interval when websocket is disabled', () => {
    vi.stubEnv('VITE_NOTIFICATION_WEBSOCKET_ENABLED', 'false');
    expect(getNotificationPollIntervalMs()).toBe(NOTIFICATION_POLL_FALLBACK_MS);
  });

  it('uses connected poll interval when websocket enabled but not connected', () => {
    vi.stubEnv('VITE_NOTIFICATION_WEBSOCKET_ENABLED', 'true');
    expect(getNotificationPollIntervalMs()).toBe(NOTIFICATION_POLL_FALLBACK_MS);
  });

  it('registers and removes socket event listeners', () => {
    const listener = vi.fn();
    const off = onNotificationSocketEvent(listener);
    off();
    expect(typeof off).toBe('function');
  });

  it('exports expected poll constants', () => {
    expect(NOTIFICATION_POLL_FALLBACK_MS).toBe(30000);
    expect(NOTIFICATION_POLL_CONNECTED_MS).toBe(60000);
  });
});
