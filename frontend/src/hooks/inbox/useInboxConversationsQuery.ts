import { useQuery } from '@tanstack/react-query';
import { fetchConversations } from '../../services/inboxService';
import { inboxQueryKeys } from './inboxQueryKeys';
import { getInboxQueryPollMs } from './inboxPolling';

export function useInboxConversationsQuery(userId?: string, enabled = true) {
  return useQuery({
    queryKey: inboxQueryKeys.conversations(userId),
    queryFn: () => fetchConversations(),
    enabled: Boolean(userId) && enabled,
    refetchInterval: () => getInboxQueryPollMs(),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });
}
