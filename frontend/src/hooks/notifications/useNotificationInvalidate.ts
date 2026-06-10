import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateNotificationQueries, signalNotificationInvalidation } from './notificationSync';

export function useNotificationInvalidate(userId?: string) {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    return invalidateNotificationQueries(queryClient, userId);
  }, [queryClient, userId]);

  const signalInvalidation = useCallback(() => {
    signalNotificationInvalidation(queryClient, userId);
  }, [queryClient, userId]);

  return { invalidateAll, signalInvalidation };
}
