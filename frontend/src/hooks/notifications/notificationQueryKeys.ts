export const notificationQueryKeys = {
  all: ['notifications'] as const,
  unread: (userId?: string) => [...notificationQueryKeys.all, 'unread', userId] as const,
  list: (userId?: string) => [...notificationQueryKeys.all, 'list', userId] as const,
};
