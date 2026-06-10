import { io, Socket } from 'socket.io-client';
import { getBackendOrigin } from '../config';
import {
  MESSAGING_SOCKET_EVENTS,
  type MessagingSocketEvent,
  type MessagingSocketPayload,
} from '../hooks/inbox/messagingEvents';

let socket: Socket | null = null;
const listeners = new Set<(event: MessagingSocketEvent) => void>();

export function isInboxWebSocketEnabled(): boolean {
  return (import.meta as any).env?.VITE_INBOX_WEBSOCKET_ENABLED === 'true';
}

function notifyListeners(type: MessagingSocketEvent['type'], payload: MessagingSocketPayload) {
  const event: MessagingSocketEvent = { type, payload };
  listeners.forEach((cb) => {
    try {
      cb(event);
    } catch {
      /* listener error */
    }
  });
}

function attachSocketHandlers(sock: Socket) {
  sock.on(MESSAGING_SOCKET_EVENTS.MESSAGE_NEW, (payload: MessagingSocketPayload) => {
    notifyListeners('message:new', payload);
  });
  sock.on(MESSAGING_SOCKET_EVENTS.CONVERSATION_UPDATED, (payload: MessagingSocketPayload) => {
    notifyListeners('conversation:updated', payload);
  });
  sock.on(MESSAGING_SOCKET_EVENTS.UNREAD_CHANGED, (payload: MessagingSocketPayload) => {
    notifyListeners('unread:changed', payload);
  });
  sock.on('connect', () => {
    notifyListeners('connect', {});
  });
  sock.on('disconnect', () => {
    notifyListeners('disconnect', {});
  });
}

export function getMessagingSocket(token: string): Socket | null {
  if (!isInboxWebSocketEnabled() || !token) return null;

  const baseURL = getBackendOrigin();

  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }

  socket = io(`${baseURL}/messaging`, {
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

export function disconnectMessagingSocket() {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
}

export function onMessagingSocketEvent(listener: (event: MessagingSocketEvent) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeToConversation(conversationId: string) {
  if (!socket?.connected || !conversationId) return;
  socket.emit('messaging:subscribe', { conversationId });
}

export function unsubscribeFromConversation(conversationId: string) {
  if (!socket?.connected || !conversationId) return;
  socket.emit('messaging:unsubscribe', { conversationId });
}

export function isMessagingSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
