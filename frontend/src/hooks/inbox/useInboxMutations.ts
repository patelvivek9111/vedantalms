import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sendMessage,
  toggleStar,
  bulkMoveConversations,
  bulkDeleteForever,
  markConversationRead,
} from '../../services/inboxService';
import { useInboxInvalidate } from './useInboxInvalidate';
import { inboxQueryKeys } from './inboxQueryKeys';

export function useInboxMutations(userId?: string) {
  const queryClient = useQueryClient();
  const { invalidateConversations, invalidateMessages, invalidateUnread } =
    useInboxInvalidate(userId);

  const markRead = useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: inboxQueryKeys.conversations(userId) });
      const previous = queryClient.getQueryData<any[]>(inboxQueryKeys.conversations(userId));
      if (Array.isArray(previous)) {
        queryClient.setQueryData(
          inboxQueryKeys.conversations(userId),
          previous.map((conv) =>
            conv._id === conversationId ? { ...conv, unreadCount: 0 } : conv
          )
        );
      }
      return { previous };
    },
    onError: (_err, _conversationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(inboxQueryKeys.conversations(userId), context.previous);
      }
    },
    onSuccess: (_data, conversationId) => {
      invalidateUnread();
      invalidateConversations();
      invalidateMessages(conversationId);
    },
  });

  const sendReply = useMutation({
    mutationFn: ({
      conversationId,
      body,
      fileAssetIds,
    }: {
      conversationId: string;
      body: string;
      fileAssetIds?: string[];
    }) => sendMessage(conversationId, body, fileAssetIds),
    onSuccess: (_data, { conversationId }) => {
      invalidateMessages(conversationId);
      invalidateConversations();
      invalidateUnread();
    },
  });

  const starConversation = useMutation({
    mutationFn: (conversationId: string) => toggleStar(conversationId),
    onSuccess: () => invalidateConversations(),
  });

  const archiveConversations = useMutation({
    mutationFn: (ids: string[]) => bulkMoveConversations(ids, 'archived'),
    onSuccess: () => {
      invalidateConversations();
      invalidateUnread();
    },
  });

  const unarchiveConversations = useMutation({
    mutationFn: (ids: string[]) => bulkMoveConversations(ids, 'inbox'),
    onSuccess: () => {
      invalidateConversations();
      invalidateUnread();
    },
  });

  const deleteConversations = useMutation({
    mutationFn: ({ ids, permanent }: { ids: string[]; permanent: boolean }) =>
      permanent ? bulkDeleteForever(ids) : bulkMoveConversations(ids, 'deleted'),
    onSuccess: () => {
      invalidateConversations();
      invalidateUnread();
    },
  });

  return {
    markRead,
    sendReply,
    starConversation,
    archiveConversations,
    unarchiveConversations,
    deleteConversations,
  };
}
