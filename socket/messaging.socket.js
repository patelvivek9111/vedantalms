const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const ConversationParticipant = require('../models/ConversationParticipant');
const { allowMessagingEvent } = require('../utils/messagingSocketThrottle');
const messagingRealtime = require('../services/messagingRealtime.service');

const socketMetrics = {
  connected: 0,
  disconnected: 0,
  authErrors: 0,
  eventErrors: 0,
  throttled: 0,
};

function authenticateSocket(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-123'
    );
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    return next();
  } catch {
    socketMetrics.authErrors += 1;
    return next(new Error('Authentication error: Invalid token'));
  }
}

function emitRateLimited(socket) {
  socketMetrics.throttled += 1;
  socket.emit('messaging:error', {
    message: 'Too many requests. Please slow down.',
    code: 'rate_limited',
  });
}

async function assertParticipant(conversationId, userId) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return false;
  }
  const row = await ConversationParticipant.findOne({
    conversationId,
    userId,
  })
    .select('_id')
    .lean();
  return Boolean(row);
}

/**
 * @param {import('socket.io').Namespace} messagingNsp
 */
function initializeMessagingSocket(messagingNsp) {
  if (process.env.INBOX_WEBSOCKET_ENABLED !== 'true') {
    return;
  }

  messagingRealtime.setMessagingNamespace(messagingNsp);

  messagingNsp.use(authenticateSocket);

  messagingNsp.on('connection', (socket) => {
    socketMetrics.connected += 1;
    const userId = socket.userId;
    socket.join(messagingRealtime.userRoom(userId));

    socket.on('messaging:subscribe', async (data) => {
      if (!allowMessagingEvent(socket, 'messaging:subscribe')) {
        return emitRateLimited(socket);
      }
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) {
          socket.emit('messaging:error', { message: 'conversationId is required', code: 'invalid_payload' });
          return;
        }
        const allowed = await assertParticipant(conversationId, userId);
        if (!allowed) {
          socket.emit('messaging:error', { message: 'Not a participant', code: 'forbidden' });
          return;
        }
        socket.join(messagingRealtime.conversationRoom(conversationId));
        socket.emit('messaging:subscribed', { conversationId: String(conversationId) });
      } catch (err) {
        socketMetrics.eventErrors += 1;
        socket.emit('messaging:error', { message: 'Subscribe failed', code: 'server_error' });
      }
    });

    socket.on('messaging:unsubscribe', (data) => {
      if (!allowMessagingEvent(socket, 'messaging:unsubscribe')) {
        return emitRateLimited(socket);
      }
      const conversationId = data?.conversationId;
      if (!conversationId) return;
      socket.leave(messagingRealtime.conversationRoom(conversationId));
      socket.emit('messaging:unsubscribed', { conversationId: String(conversationId) });
    });

    socket.on('disconnect', () => {
      socketMetrics.disconnected += 1;
    });
  });
}

function getMessagingSocketMetrics() {
  return {
    ...socketMetrics,
    currentlyConnected: Math.max(0, socketMetrics.connected - socketMetrics.disconnected),
    enabled: process.env.INBOX_WEBSOCKET_ENABLED === 'true',
  };
}

module.exports = {
  initializeMessagingSocket,
  getMessagingSocketMetrics,
};
