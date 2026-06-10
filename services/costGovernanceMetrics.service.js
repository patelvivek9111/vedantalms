/**
 * Rolling counters for cost-governance signals (poll traffic vs realtime WS).
 */
const startedAt = Date.now();

const counters = {
  notificationUnreadPoll: 0,
  notificationListPoll: 0,
  inboxUnreadPoll: 0,
  inboxConversationsPoll: 0,
};

const POLL_PATHS = Object.freeze({
  notificationUnreadPoll: '/api/notifications/unread-count',
  notificationListPoll: '/api/notifications',
  inboxUnreadPoll: '/api/inbox/unread-count',
  inboxConversationsPoll: '/api/inbox/conversations',
});

function normalizePath(url = '') {
  const path = String(url).split('?')[0];
  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
}

function recordPollRequest(method, url) {
  if (method !== 'GET') return;
  const path = normalizePath(url);
  if (path === POLL_PATHS.notificationUnreadPoll) counters.notificationUnreadPoll += 1;
  else if (path === POLL_PATHS.notificationListPoll) counters.notificationListPoll += 1;
  else if (path === POLL_PATHS.inboxUnreadPoll) counters.inboxUnreadPoll += 1;
  else if (path === POLL_PATHS.inboxConversationsPoll) counters.inboxConversationsPoll += 1;
}

function perHour(count) {
  const elapsedHours = Math.max((Date.now() - startedAt) / (60 * 60 * 1000), 1 / 60);
  return Math.round(count / elapsedHours);
}

function buildPollMetrics() {
  const notificationPollTotal = counters.notificationUnreadPoll + counters.notificationListPoll;
  const inboxPollTotal = counters.inboxUnreadPoll + counters.inboxConversationsPoll;
  const totalPoll = notificationPollTotal + inboxPollTotal;

  return {
    since: new Date(startedAt).toISOString(),
    counters: { ...counters },
    estimatedPerHour: {
      notificationUnreadPoll: perHour(counters.notificationUnreadPoll),
      notificationListPoll: perHour(counters.notificationListPoll),
      inboxUnreadPoll: perHour(counters.inboxUnreadPoll),
      inboxConversationsPoll: perHour(counters.inboxConversationsPoll),
      totalPoll: perHour(totalPoll),
    },
  };
}

function buildRealtimeEfficiencySnapshot({
  notificationSocketMetrics = {},
  messagingSocketMetrics = {},
} = {}) {
  const poll = buildPollMetrics();
  const notificationWsConnected = notificationSocketMetrics.currentlyConnected || 0;
  const inboxWsConnected = messagingSocketMetrics.currentlyConnected || 0;
  const wsConnectedTotal = notificationWsConnected + inboxWsConnected;
  const pollPerHour = poll.estimatedPerHour.totalPoll;

  let status = 'healthy';
  let note = null;

  if (
    notificationSocketMetrics.enabled === false &&
    messagingSocketMetrics.enabled === false &&
    pollPerHour > 1000
  ) {
    status = 'degraded';
    note = 'Both notification and inbox websockets disabled with elevated poll traffic';
  } else if (wsConnectedTotal === 0 && pollPerHour > 5000) {
    status = 'warning';
    note = 'No websocket connections but high badge/list poll rate — verify WS env flags and Redis adapter';
  } else if (wsConnectedTotal > 0 && pollPerHour > wsConnectedTotal * 720) {
    status = 'warning';
    note = 'Poll rate exceeds ~720/hr per WS connection — clients may not be using websocket fallback correctly';
  }

  return {
    status,
    note,
    poll,
    websockets: {
      notification: {
        enabled: Boolean(notificationSocketMetrics.enabled),
        currentlyConnected: notificationWsConnected,
      },
      inbox: {
        enabled: Boolean(messagingSocketMetrics.enabled),
        currentlyConnected: inboxWsConnected,
      },
      totalConnected: wsConnectedTotal,
    },
    ratios: {
      pollPerHourPerWsConnection:
        wsConnectedTotal > 0 ? Number((pollPerHour / wsConnectedTotal).toFixed(2)) : null,
    },
  };
}

module.exports = {
  POLL_PATHS,
  recordPollRequest,
  buildPollMetrics,
  buildRealtimeEfficiencySnapshot,
};
