const notificationRealtime = require('../services/notification/notificationRealtime.service');
const { authenticateSocket: verifySocketAuth } = require('../utils/socketAuth');

const socketMetrics = {
  connected: 0,
  disconnected: 0,
  authErrors: 0,
};

function authenticateSocket(socket, next) {
  verifySocketAuth(socket, next).catch(() => {
    socketMetrics.authErrors += 1;
    next(new Error('Authentication error: Invalid token'));
  });
}

/**
 * @param {import('socket.io').Namespace} notificationNsp
 */
function initializeNotificationSocket(notificationNsp) {
  if (process.env.NOTIFICATION_WEBSOCKET_ENABLED !== 'true') {
    return;
  }

  notificationRealtime.setNotificationNamespace(notificationNsp);
  notificationNsp.use(authenticateSocket);

  notificationNsp.on('connection', (socket) => {
    socketMetrics.connected += 1;
    socket.join(notificationRealtime.userRoom(socket.userId));

    socket.on('disconnect', () => {
      socketMetrics.disconnected += 1;
    });
  });
}

function getNotificationSocketMetrics() {
  return {
    ...socketMetrics,
    currentlyConnected: Math.max(0, socketMetrics.connected - socketMetrics.disconnected),
    enabled: process.env.NOTIFICATION_WEBSOCKET_ENABLED === 'true',
  };
}

module.exports = {
  initializeNotificationSocket,
  getNotificationSocketMetrics,
};
