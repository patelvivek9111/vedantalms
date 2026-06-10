export const MESSAGING_SOCKET_EVENTS = {
  MESSAGE_NEW: 'messaging:message:new',
  CONVERSATION_UPDATED: 'messaging:conversation:updated',
  UNREAD_CHANGED: 'messaging:unread:changed',
  ERROR: 'messaging:error',
} as const;

export type MessagingSocketPayload = {
  conversationId?: string;
  messageId?: string;
  senderId?: string;
  userId?: string;
  at?: string;
};

export type MessagingSocketEvent = {
  type: keyof typeof MESSAGING_SOCKET_EVENTS | 'message:new' | 'conversation:updated' | 'unread:changed';
  payload: MessagingSocketPayload;
};
