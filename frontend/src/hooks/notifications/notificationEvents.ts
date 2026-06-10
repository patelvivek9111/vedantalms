export const NOTIFICATION_SOCKET_EVENTS = {
  INVALIDATED: 'notification:invalidated',
} as const;

export type NotificationInvalidationReason = 'created' | 'read' | 'read_all' | 'deleted';

export type NotificationSocketPayload = {
  userId?: string;
  reason?: NotificationInvalidationReason;
  notificationId?: string;
  at?: string;
};

export type NotificationSocketEvent = {
  type: 'invalidated' | 'connect' | 'disconnect';
  payload: NotificationSocketPayload;
};
