import { useQuery } from '@tanstack/react-query';
import { fetchNotificationUnreadCount } from '../../services/notificationService';
import { notificationQueryKeys } from './notificationQueryKeys';
import { getNotificationQueryPollMs } from './notificationPolling';

export function useNotificationUnreadQuery(userId?: string) {
  return useQuery({
    queryKey: notificationQueryKeys.unread(userId),
    queryFn: fetchNotificationUnreadCount,
    enabled: Boolean(userId),
    refetchInterval: () => getNotificationQueryPollMs(),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
  });
}
