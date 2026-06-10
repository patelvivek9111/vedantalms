import { io, Socket } from 'socket.io-client';
import { getBackendOrigin } from '../config';
import {
  NOTIFICATION_SOCKET_EVENTS,
  type NotificationSocketEvent,
  type NotificationSocketPayload,
} from '../hooks/notifications/notificationEvents';

let socket: Socket | null = null;
const listeners = new Set<(event: NotificationSocketEvent) => void>();

/** Minimum poll interval when websocket is off or disconnected (ms). */
export const NOTIFICATION_POLL_MIN_MS = 30_000;
/** Polling fallback interval when websocket is connected (ms). */
export const NOTIFICATION_POLL_CONNECTED_MS = 60_000;
/** Default polling interval when websocket is off or disconnected (ms). */
export const NOTIFICATION_POLL_FALLBACK_MS = 30_000;

export function isNotificationWebSocketEnabled(): boolean {
  return (import.meta as any).env?.VITE_NOTIFICATION_WEBSOCKET_ENABLED === 'true';
}

export function getNotificationPollIntervalMs(): number {
  if (!isNotificationWebSocketEnabled()) {
    return NOTIFICATION_POLL_FALLBACK_MS;
  }
  return isNotificationSocketConnected()
    ? NOTIFICATION_POLL_CONNECTED_MS
    : NOTIFICATION_POLL_FALLBACK_MS;
}

function notifyListeners(type: NotificationSocketEvent['type'], payload: NotificationSocketPayload) {
  const event: NotificationSocketEvent = { type, payload };
  listeners.forEach((cb) => {
    try {
      cb(event);
    } catch {
      /* listener error */
    }
  });
}

function attachSocketHandlers(sock: Socket) {
  sock.on(NOTIFICATION_SOCKET_EVENTS.INVALIDATED, (payload: NotificationSocketPayload) => {
    notifyListeners('invalidated', payload);
  });
  sock.on('connect', () => {
    notifyListeners('connect', {});
  });
  sock.on('disconnect', () => {
    notifyListeners('disconnect', {});
  });
}

export function getNotificationSocket(token: string): Socket | null {
  if (!isNotificationWebSocketEnabled() || !token) return null;

  const baseURL = getBackendOrigin();

  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }

  socket = io(`${baseURL}/notifications`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    forceNew: false,
  });

  attachSocketHandlers(socket);
  return socket;
}

export function disconnectNotificationSocket() {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
}

export function onNotificationSocketEvent(listener: (event: NotificationSocketEvent) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isNotificationSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
