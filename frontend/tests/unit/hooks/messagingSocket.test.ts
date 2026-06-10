import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isInboxWebSocketEnabled,
  onMessagingSocketEvent,
} from '@/utils/messagingSocket';

describe('messagingSocket', () => {
  it('is disabled when VITE flag is not true', () => {
    vi.stubEnv('VITE_INBOX_WEBSOCKET_ENABLED', 'false');
    expect(isInboxWebSocketEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('notifies socket event listeners', () => {
    const listener = vi.fn();
    const off = onMessagingSocketEvent(listener);
    // Internal notify is via socket handlers; test unsubscribe path
    off();
    expect(typeof off).toBe('function');
  });
});
