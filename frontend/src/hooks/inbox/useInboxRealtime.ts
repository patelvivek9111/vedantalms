import { useEffect, useRef } from 'react';
import {
  getMessagingSocket,
  isInboxWebSocketEnabled,
  subscribeToConversation,
  unsubscribeFromConversation,
} from '../../utils/messagingSocket';

type InboxRealtimeOptions = {
  token?: string | null;
  conversationId?: string;
  enabled?: boolean;
};

/**
 * Joins/leaves conversation rooms on the /messaging namespace for active thread updates.
 * Global invalidation is handled by useMessagingSocketConnection in App.
 */
export function useInboxRealtime({
  token,
  conversationId,
  enabled = true,
}: InboxRealtimeOptions) {
  const subscribedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isInboxWebSocketEnabled() || !enabled || !token) {
      return undefined;
    }

    getMessagingSocket(token);

    const prev = subscribedRef.current;
    if (prev && prev !== conversationId) {
      unsubscribeFromConversation(prev);
      subscribedRef.current = null;
    }

    if (conversationId) {
      subscribeToConversation(conversationId);
      subscribedRef.current = conversationId;
    }

    return () => {
      if (subscribedRef.current) {
        unsubscribeFromConversation(subscribedRef.current);
        subscribedRef.current = null;
      }
    };
  }, [conversationId, token, enabled]);
}
