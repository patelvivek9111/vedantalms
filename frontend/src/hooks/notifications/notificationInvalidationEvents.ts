import { queryClient } from '../../lib/queryClient';
import type { NotificationSocketPayload } from './notificationEvents';
import { signalNotificationInvalidation } from './notificationSync';

/** @deprecated Use signalNotificationInvalidation / React Query instead of DOM events. */
export const NOTIFICATION_INVALIDATED_EVENT = 'notificationInvalidated';

/**
 * Legacy bridge for code not yet on React Query. Prefer signalNotificationInvalidation.
 */
export function dispatchNotificationInvalidated(payload: NotificationSocketPayload = {}) {
  signalNotificationInvalidation(queryClient, payload.userId);
}
