import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { inboxQueryKeys } from './inboxQueryKeys';
import { dispatchInboxMessageRead } from './inboxEvents';

export function useInboxInvalidate(userId?: string) {
  const queryClient = useQueryClient();

  const invalidateConversations = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: inboxQueryKeys.conversations(userId) });
  }, [queryClient, userId]);

  const invalidateMessages = useCallback(
    (conversationId: string) => {
      return queryClient.invalidateQueries({ queryKey: inboxQueryKeys.messages(conversationId) });
    },
    [queryClient]
  );

  const invalidateUnread = useCallback(() => {
    dispatchInboxMessageRead();
    return queryClient.invalidateQueries({ queryKey: inboxQueryKeys.unread(userId) });
  }, [queryClient, userId]);

  const invalidateAll = useCallback(() => {
    dispatchInboxMessageRead();
    return queryClient.invalidateQueries({ queryKey: inboxQueryKeys.all });
  }, [queryClient]);

  return {
    invalidateConversations,
    invalidateMessages,
    invalidateUnread,
    invalidateAll,
  };
}
