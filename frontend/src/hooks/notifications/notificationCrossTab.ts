const CHANNEL_NAME = 'lms-notification-sync';
const STORAGE_KEY = 'lms-notification-sync';

export type NotificationCrossTabMessage = {
  type: 'invalidated';
  userId?: string;
  at: number;
};

let channel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

/**
 * Notify other browser tabs to invalidate notification queries.
 * BroadcastChannel does not echo to the sending tab.
 */
export function publishNotificationCrossTab(
  message: Pick<NotificationCrossTabMessage, 'type' | 'userId'>
) {
  const payload: NotificationCrossTabMessage = {
    ...message,
    at: Date.now(),
  };

  const bc = getBroadcastChannel();
  if (bc) {
    bc.postMessage(payload);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function subscribeNotificationCrossTab(
  handler: (message: NotificationCrossTabMessage) => void
): () => void {
  const cleaners: Array<() => void> = [];

  const bc = getBroadcastChannel();
  if (bc) {
    const onMessage = (event: MessageEvent<NotificationCrossTabMessage>) => {
      if (event.data?.type === 'invalidated') {
        handler(event.data);
      }
    };
    bc.addEventListener('message', onMessage);
    cleaners.push(() => bc.removeEventListener('message', onMessage));
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as NotificationCrossTabMessage;
      if (parsed?.type === 'invalidated') {
        handler(parsed);
      }
    } catch {
      /* ignore malformed payload */
    }
  };

  window.addEventListener('storage', onStorage);
  cleaners.push(() => window.removeEventListener('storage', onStorage));

  return () => {
    cleaners.forEach((fn) => fn());
  };
}
