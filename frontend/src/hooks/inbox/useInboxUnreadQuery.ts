import { useQuery } from '@tanstack/react-query';
import { fetchInboxUnreadCount } from '../../services/inboxService';
import { inboxQueryKeys } from './inboxQueryKeys';
import { getInboxQueryPollMs } from './inboxPolling';

async function fetchUnreadCount(userId: string): Promise<number> {
  return fetchInboxUnreadCount();
}

export function useInboxUnreadQuery(userId?: string) {
  return useQuery({
    queryKey: inboxQueryKeys.unread(userId),
    queryFn: () => fetchUnreadCount(userId!),
    enabled: Boolean(userId),
    refetchInterval: () => getInboxQueryPollMs(),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });
}
