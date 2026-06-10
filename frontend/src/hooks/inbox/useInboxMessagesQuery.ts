import { useQuery } from '@tanstack/react-query';
import { fetchMessages } from '../../services/inboxService';
import { inboxQueryKeys } from './inboxQueryKeys';

export function useInboxMessagesQuery(conversationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: inboxQueryKeys.messages(conversationId),
    queryFn: () => fetchMessages(conversationId!),
    enabled: Boolean(conversationId) && enabled,
    staleTime: 5_000,
  });
}
