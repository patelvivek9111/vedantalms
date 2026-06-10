import type { QueryClient } from '@tanstack/react-query';
import { notificationQueryKeys } from './notificationQueryKeys';
import { publishNotificationCrossTab } from './notificationCrossTab';

export function invalidateNotificationQueries(queryClient: QueryClient, userId?: string) {
  if (userId) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unread(userId) }),
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.list(userId) }),
    ]);
  }
  return queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
}

/**
 * Invalidate local React Query cache and signal other tabs (websocket/polling handle server drift).
 */
export function signalNotificationInvalidation(queryClient: QueryClient, userId?: string) {
  void invalidateNotificationQueries(queryClient, userId);
  publishNotificationCrossTab({ type: 'invalidated', userId });
}
