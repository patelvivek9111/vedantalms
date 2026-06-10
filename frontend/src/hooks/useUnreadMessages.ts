import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useInboxUnreadQuery } from './inbox/useInboxUnreadQuery';
import { inboxQueryKeys } from './inbox/inboxQueryKeys';
import { INBOX_MESSAGE_READ_EVENT } from './inbox/inboxEvents';

export const useUnreadMessages = () => {
  const { user } = useAuth() as { user?: { _id?: string } };
  const userId = user?._id;
  const queryClient = useQueryClient();
  const { data: unreadCount = 0, isLoading: loading, refetch } = useInboxUnreadQuery(userId);

  useEffect(() => {
    const handleInboxMessageRead = () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: inboxQueryKeys.unread(userId) });
      }
    };
    window.addEventListener(INBOX_MESSAGE_READ_EVENT, handleInboxMessageRead);
    return () => window.removeEventListener(INBOX_MESSAGE_READ_EVENT, handleInboxMessageRead);
  }, [userId, queryClient]);

  return {
    unreadCount,
    loading,
    refreshUnreadCount: refetch,
  };
};
