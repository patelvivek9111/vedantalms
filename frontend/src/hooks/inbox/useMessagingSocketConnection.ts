import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  disconnectMessagingSocket,
  getMessagingSocket,
  isInboxWebSocketEnabled,
  onMessagingSocketEvent,
} from '../../utils/messagingSocket';
import { inboxQueryKeys } from './inboxQueryKeys';
import { dispatchInboxMessageRead } from './inboxEvents';

/**
 * Maintains a single /messaging socket for the authenticated session (nav badge, background sync).
 */
export function useMessagingSocketConnection(userId?: string, token?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isInboxWebSocketEnabled() || !userId || !token) {
      disconnectMessagingSocket();
      return undefined;
    }

    getMessagingSocket(token);

    const off = onMessagingSocketEvent((event) => {
      if (event.type === 'message:new') {
        queryClient.invalidateQueries({ queryKey: inboxQueryKeys.conversations(userId) });
        if (event.payload.senderId !== userId) {
          dispatchInboxMessageRead();
        }
        return;
      }
      if (event.type === 'unread:changed') {
        queryClient.invalidateQueries({ queryKey: inboxQueryKeys.unread(userId) });
        return;
      }
      if (event.type === 'conversation:updated') {
        queryClient.invalidateQueries({ queryKey: inboxQueryKeys.conversations(userId) });
      }
    });

    return () => {
      off();
    };
  }, [userId, token, queryClient]);

  useEffect(() => {
    if (!token) {
      disconnectMessagingSocket();
    }
  }, [token]);
}
