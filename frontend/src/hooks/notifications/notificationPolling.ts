import { getNotificationPollIntervalMs, NOTIFICATION_POLL_MIN_MS } from '../../utils/notificationSocket';

/** Shared notification poll interval — React Query dedupes badge + panel subscriptions. */
export function getNotificationQueryPollMs(): number {
  const envMs = (import.meta as any).env?.VITE_NOTIFICATION_POLL_MS;
  if (envMs != null && envMs !== '') {
    const parsed = parseInt(String(envMs), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(NOTIFICATION_POLL_MIN_MS, parsed);
    }
  }
  return getNotificationPollIntervalMs();
}
