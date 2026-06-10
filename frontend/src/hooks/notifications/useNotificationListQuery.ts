import { useQuery } from '@tanstack/react-query';
import { fetchNotificationList } from '../../services/notificationService';
import { notificationQueryKeys } from './notificationQueryKeys';
import { getNotificationQueryPollMs } from './notificationPolling';

export function useNotificationListQuery(userId?: string, enabled = true) {
  return useQuery({
    queryKey: notificationQueryKeys.list(userId),
    queryFn: () => fetchNotificationList(20),
    enabled: Boolean(userId) && enabled,
    refetchInterval: enabled ? () => getNotificationQueryPollMs() : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 5_000,
  });
}
