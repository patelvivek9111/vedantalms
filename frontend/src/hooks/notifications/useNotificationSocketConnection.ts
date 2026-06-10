import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  disconnectNotificationSocket,
  getNotificationSocket,
  isNotificationWebSocketEnabled,
  onNotificationSocketEvent,
} from '../../utils/notificationSocket';
import { notificationQueryKeys } from './notificationQueryKeys';
import { signalNotificationInvalidation } from './notificationSync';

/**
 * Maintains a single /notifications socket; invalidates React Query + cross-tab sync on events.
 */
export function useNotificationSocketConnection(userId?: string, token?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isNotificationWebSocketEnabled() || !userId || !token) {
      disconnectNotificationSocket();
      return undefined;
    }

    getNotificationSocket(token);

    const off = onNotificationSocketEvent((event) => {
      if (event.type === 'invalidated') {
        signalNotificationInvalidation(queryClient, userId);
      }
    });

    return () => {
      off();
    };
  }, [userId, token, queryClient]);

  useEffect(() => {
    if (!token) {
      disconnectNotificationSocket();
    }
  }, [token]);
}
