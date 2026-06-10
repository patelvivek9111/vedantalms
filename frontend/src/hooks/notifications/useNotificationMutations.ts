import { useMutation } from '@tanstack/react-query';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../../services/notificationService';
import { useNotificationInvalidate } from './useNotificationInvalidate';

export function useNotificationMutations(userId?: string) {
  const { signalInvalidation } = useNotificationInvalidate(userId);

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => signalInvalidation(),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => signalInvalidation(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => signalInvalidation(),
  });

  return { markRead, markAllRead, remove };
}

export type { NotificationItem };
