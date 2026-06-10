import api from './api';

export type NotificationItem = {
  _id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  priority?: string;
};

export type NotificationListResult = {
  items: NotificationItem[];
  unreadCount: number;
};

export const fetchNotificationUnreadCount = async (): Promise<number> => {
  const res = await api.get('/notifications/unread-count');
  return typeof res.data?.count === 'number' ? res.data.count : 0;
};

export const fetchNotificationList = async (limit = 20): Promise<NotificationListResult> => {
  const res = await api.get('/notifications', { params: { limit } });
  return {
    items: Array.isArray(res.data?.data) ? res.data.data : [],
    unreadCount: typeof res.data?.unreadCount === 'number' ? res.data.unreadCount : 0,
  };
};

export const markNotificationRead = async (id: string) => {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
};

export const markAllNotificationsRead = async () => {
  const res = await api.patch('/notifications/read-all');
  return res.data;
};

export const deleteNotification = async (id: string) => {
  const res = await api.delete(`/notifications/${id}`);
  return res.data;
};
