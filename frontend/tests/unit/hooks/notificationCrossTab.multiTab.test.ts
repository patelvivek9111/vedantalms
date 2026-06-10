import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { notificationQueryKeys } from '@/hooks/notifications/notificationQueryKeys';
import { useNotificationCrossTabSync } from '@/hooks/notifications/useNotificationCrossTabSync';

class MockBroadcastChannel {
  static channels = new Map<string, MockBroadcastChannel[]>();
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    const list = MockBroadcastChannel.channels.get(name) || [];
    list.push(this);
    MockBroadcastChannel.channels.set(name, list);
  }

  postMessage(data: unknown) {
    const peers = MockBroadcastChannel.channels.get(this.name) || [];
    for (const peer of peers) {
      if (peer !== this && peer.onmessage) {
        peer.onmessage({ data } as MessageEvent);
      }
    }
  }

  addEventListener(_type: string, handler: (event: MessageEvent) => void) {
    this.onmessage = handler;
  }

  removeEventListener() {
    this.onmessage = null;
  }

  close() {}
}

describe('useNotificationCrossTabSync multi-tab simulation', () => {
  const originalBc = globalThis.BroadcastChannel;
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    MockBroadcastChannel.channels.clear();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel as unknown as typeof BroadcastChannel);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalBc) {
      globalThis.BroadcastChannel = originalBc;
    }
  });

  it('invalidates queries when another tab publishes invalidation', async () => {
    const tabB = new MockBroadcastChannel('lms-notification-sync');

    renderHook(() => useNotificationCrossTabSync('user-1'), { wrapper });

    tabB.postMessage({ type: 'invalidated', userId: 'user-1', at: Date.now() });

    await waitFor(() => {
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: notificationQueryKeys.unread('user-1'),
      });
    });
  });

});
