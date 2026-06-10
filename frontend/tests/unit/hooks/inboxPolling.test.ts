import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getInboxQueryPollMs,
  INBOX_POLL_MS,
  INBOX_POLL_CONNECTED_MS,
} from '@/hooks/inbox/inboxPolling';

vi.mock('@/utils/messagingSocket', () => ({
  isInboxWebSocketEnabled: vi.fn(() => false),
  isMessagingSocketConnected: vi.fn(() => false),
}));

import {
  isInboxWebSocketEnabled,
  isMessagingSocketConnected,
} from '@/utils/messagingSocket';

describe('inboxPolling', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(isInboxWebSocketEnabled).mockReturnValue(false);
    vi.mocked(isMessagingSocketConnected).mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses fallback interval when websocket is disabled', () => {
    expect(getInboxQueryPollMs()).toBe(INBOX_POLL_MS);
  });

  it('uses connected interval when websocket is enabled and connected', () => {
    vi.mocked(isInboxWebSocketEnabled).mockReturnValue(true);
    vi.mocked(isMessagingSocketConnected).mockReturnValue(true);
    expect(getInboxQueryPollMs()).toBe(INBOX_POLL_CONNECTED_MS);
  });

  it('uses fallback interval when websocket enabled but disconnected', () => {
    vi.mocked(isInboxWebSocketEnabled).mockReturnValue(true);
    vi.mocked(isMessagingSocketConnected).mockReturnValue(false);
    expect(getInboxQueryPollMs()).toBe(INBOX_POLL_MS);
  });
});
