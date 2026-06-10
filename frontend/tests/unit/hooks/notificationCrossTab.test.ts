import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  publishNotificationCrossTab,
  subscribeNotificationCrossTab,
} from '@/hooks/notifications/notificationCrossTab';

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

describe('notificationCrossTab', () => {
  const originalBc = globalThis.BroadcastChannel;

  beforeEach(() => {
    MockBroadcastChannel.channels.clear();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel as unknown as typeof BroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBc) {
      globalThis.BroadcastChannel = originalBc;
    } else {
      delete (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
    }
  });

  it('delivers invalidation to subscribers in other channel instances', () => {
    const channelA = new MockBroadcastChannel('lms-notification-sync');
    const channelB = new MockBroadcastChannel('lms-notification-sync');

    const handler = vi.fn();
    channelB.addEventListener('message', (event) => {
      if (event.data?.type === 'invalidated') handler(event.data);
    });

    channelA.postMessage({ type: 'invalidated', userId: 'user-1', at: Date.now() });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invalidated', userId: 'user-1' })
    );
  });

  it('subscribeNotificationCrossTab invokes handler when a peer tab posts', () => {
    subscribeNotificationCrossTab(() => {});
    const tabB = new MockBroadcastChannel('lms-notification-sync');

    const handler = vi.fn();
    const off = subscribeNotificationCrossTab(handler);

    tabB.postMessage({ type: 'invalidated', userId: 'user-2', at: Date.now() });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invalidated', userId: 'user-2' })
    );

    off();
  });

  it('subscribeNotificationCrossTab handles storage events', () => {
    const handler = vi.fn();
    const off = subscribeNotificationCrossTab(handler);

    const payload = JSON.stringify({
      type: 'invalidated',
      userId: 'user-3',
      at: Date.now(),
    });

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'lms-notification-sync',
        newValue: payload,
      })
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invalidated', userId: 'user-3' })
    );

    off();
  });
});
