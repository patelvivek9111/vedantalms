import { useAuth } from '../../contexts/AuthContext';
import { useNotificationUnreadQuery } from './useNotificationUnreadQuery';

/** Canonical notification (non-inbox) unread badge — distinct from inbox `useUnreadMessages`. */
export function useNotificationBadge() {
  const { user } = useAuth() as { user?: { _id?: string } };
  const userId = user?._id;
  const { data: unreadCount = 0, isLoading: loading, refetch } = useNotificationUnreadQuery(userId);

  return {
    unreadCount,
    loading,
    refreshUnreadCount: refetch,
  };
}
