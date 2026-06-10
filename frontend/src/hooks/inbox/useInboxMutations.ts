import { useMutation } from '@tanstack/react-query';
import {
  sendMessage,
  toggleStar,
  bulkMoveConversations,
  bulkDeleteForever,
  markConversationRead,
} from '../../services/inboxService';
import { useInboxInvalidate } from './useInboxInvalidate';

export function useInboxMutations(userId?: string) {
  const { invalidateConversations, invalidateMessages, invalidateUnread } =
    useInboxInvalidate(userId);

  const markRead = useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
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
