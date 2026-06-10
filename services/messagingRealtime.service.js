/**
 * Server-side emit helpers for /messaging Socket.IO namespace.
 * No-ops when INBOX_WEBSOCKET_ENABLED is not true.
 */

let messagingNamespace = null;

const EVENTS = {
  MESSAGE_NEW: 'messaging:message:new',
  CONVERSATION_UPDATED: 'messaging:conversation:updated',
  UNREAD_CHANGED: 'messaging:unread:changed',
};

function isEnabled() {
  return process.env.INBOX_WEBSOCKET_ENABLED === 'true' && messagingNamespace != null;
}

function setMessagingNamespace(nsp) {
  messagingNamespace = nsp || null;
}

function normalizeId(value) {
  if (!value) return '';
  return String(value._id || value);
}

function userRoom(userId) {
  return `user:${normalizeId(userId)}`;
}

function conversationRoom(conversationId) {
  return `conversation:${normalizeId(conversationId)}`;
}

function emitToRoom(room, event, payload) {
  if (!isEnabled()) return;
  messagingNamespace.to(room).emit(event, payload);
}

function emitToUsers(userIds, event, payload) {
  if (!isEnabled() || !userIds?.length) return;
  const unique = [...new Set(userIds.map(normalizeId).filter(Boolean))];
  for (const id of unique) {
    emitToRoom(userRoom(id), event, payload);
  }
}

async function notifyMessageNew({ conversationId, messageId, senderId, participantUserIds = [] }) {
  const payload = {
    conversationId: normalizeId(conversationId),
    messageId: normalizeId(messageId),
    senderId: normalizeId(senderId),
    at: new Date().toISOString(),
  };
  emitToRoom(conversationRoom(conversationId), EVENTS.MESSAGE_NEW, payload);
  emitToUsers(participantUserIds, EVENTS.UNREAD_CHANGED, {
    conversationId: payload.conversationId,
    at: payload.at,
  });
}

async function notifyConversationCreated({
  conversationId,
  participantUserIds = [],
  senderId,
}) {
  const payload = {
    conversationId: normalizeId(conversationId),
    senderId: normalizeId(senderId),
    at: new Date().toISOString(),
  };
  emitToUsers(participantUserIds, EVENTS.CONVERSATION_UPDATED, payload);
  emitToUsers(participantUserIds, EVENTS.UNREAD_CHANGED, payload);
}

async function notifyConversationRead({ conversationId, userId, participantUserIds = [] }) {
  const payload = {
    conversationId: normalizeId(conversationId),
    userId: normalizeId(userId),
    at: new Date().toISOString(),
  };
  emitToUsers(participantUserIds, EVENTS.UNREAD_CHANGED, payload);
  emitToUsers(participantUserIds, EVENTS.CONVERSATION_UPDATED, payload);
}

module.exports = {
  EVENTS,
  isEnabled,
  setMessagingNamespace,
  notifyMessageNew,
  notifyConversationCreated,
  notifyConversationRead,
  userRoom,
  conversationRoom,
};
