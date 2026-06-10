import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeNotificationCrossTab } from './notificationCrossTab';
import { invalidateNotificationQueries } from './notificationSync';

/** Sync notification badge/list across browser tabs via BroadcastChannel + storage fallback. */
export function useNotificationCrossTabSync(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return undefined;

    return subscribeNotificationCrossTab((message) => {
      void invalidateNotificationQueries(queryClient, message.userId || userId);
    });
  }, [userId, queryClient]);
}
