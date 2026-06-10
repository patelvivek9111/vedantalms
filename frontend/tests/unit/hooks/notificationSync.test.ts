import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { notificationQueryKeys } from '@/hooks/notifications/notificationQueryKeys';
import {
  invalidateNotificationQueries,
  signalNotificationInvalidation,
} from '@/hooks/notifications/notificationSync';

vi.mock('@/hooks/notifications/notificationCrossTab', () => ({
  publishNotificationCrossTab: vi.fn(),
}));

import { publishNotificationCrossTab } from '@/hooks/notifications/notificationCrossTab';

describe('notificationSync', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(queryClient, 'invalidateQueries');
  });

  it('invalidates unread and list keys for a user', async () => {
    await invalidateNotificationQueries(queryClient, 'user-1');

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: notificationQueryKeys.unread('user-1'),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: notificationQueryKeys.list('user-1'),
    });
  });

  it('signalNotificationInvalidation invalidates and publishes cross-tab', () => {
    signalNotificationInvalidation(queryClient, 'user-1');

    expect(queryClient.invalidateQueries).toHaveBeenCalled();
    expect(publishNotificationCrossTab).toHaveBeenCalledWith({
      type: 'invalidated',
      userId: 'user-1',
    });
  });
});
