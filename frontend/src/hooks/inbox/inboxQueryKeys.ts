export const inboxQueryKeys = {
  all: ['inbox'] as const,
  conversations: (userId?: string) => [...inboxQueryKeys.all, 'conversations', userId] as const,
  messages: (conversationId?: string) => [...inboxQueryKeys.all, 'messages', conversationId] as const,
  unread: (userId?: string) => [...inboxQueryKeys.all, 'unread', userId] as const,
};
