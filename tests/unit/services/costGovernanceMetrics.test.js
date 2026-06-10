const {
  recordPollRequest,
  buildRealtimeEfficiencySnapshot,
} = require('../../../services/costGovernanceMetrics.service');

describe('costGovernanceMetrics.service', () => {
  it('counts notification and inbox poll endpoints', () => {
    recordPollRequest('GET', '/api/notifications/unread-count');
    recordPollRequest('GET', '/api/inbox/unread-count');
    recordPollRequest('POST', '/api/inbox/unread-count');

    const snapshot = buildRealtimeEfficiencySnapshot({
      notificationSocketMetrics: { enabled: true, currentlyConnected: 2 },
      messagingSocketMetrics: { enabled: true, currentlyConnected: 3 },
    });

    expect(snapshot.poll.counters.notificationUnreadPoll).toBeGreaterThanOrEqual(1);
    expect(snapshot.poll.counters.inboxUnreadPoll).toBeGreaterThanOrEqual(1);
    expect(snapshot.websockets.totalConnected).toBe(5);
  });

  it('flags degraded when websockets disabled and poll rate high', () => {
    for (let i = 0; i < 2000; i += 1) {
      recordPollRequest('GET', '/api/notifications/unread-count');
    }

    const snapshot = buildRealtimeEfficiencySnapshot({
      notificationSocketMetrics: { enabled: false, currentlyConnected: 0 },
      messagingSocketMetrics: { enabled: false, currentlyConnected: 0 },
    });

    expect(['warning', 'degraded']).toContain(snapshot.status);
  });
});
