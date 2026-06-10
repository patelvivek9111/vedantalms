const observability = require('../../../services/workflowObservability.service');
const notificationRealtime = require('../../../services/notification/notificationRealtime.service');

jest.mock('../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

describe('notificationRealtime.service', () => {
  const originalFlag = process.env.NOTIFICATION_WEBSOCKET_ENABLED;
  let mockEmit;

  beforeEach(() => {
    process.env.NOTIFICATION_WEBSOCKET_ENABLED = 'true';
    jest.clearAllMocks();
    mockEmit = jest.fn();
    notificationRealtime.setNotificationNamespace({
      to: () => ({ emit: mockEmit }),
    });
  });

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env.NOTIFICATION_WEBSOCKET_ENABLED;
    } else {
      process.env.NOTIFICATION_WEBSOCKET_ENABLED = originalFlag;
    }
    notificationRealtime.setNotificationNamespace(null);
  });

  it('emits notification:invalidated to user room', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const notificationId = '507f1f77bcf86cd799439012';

    await notificationRealtime.notifyNotificationInvalidated({
      userId,
      reason: 'created',
      notificationId,
      source: 'submission.graded',
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'notification:invalidated',
      expect.objectContaining({
        userId,
        reason: 'created',
        notificationId,
        at: expect.any(String),
      })
    );
    expect(observability.metric).toHaveBeenCalledWith(
      'notification_realtime_invalidated',
      expect.objectContaining({ reason: 'created' })
    );
  });

  it('no-ops when websocket flag is disabled', async () => {
    process.env.NOTIFICATION_WEBSOCKET_ENABLED = 'false';
    mockEmit.mockClear();

    await notificationRealtime.notifyNotificationInvalidated({
      userId: '507f1f77bcf86cd799439011',
      reason: 'read',
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('normalizes invalid reason to created', async () => {
    await notificationRealtime.notifyNotificationInvalidated({
      userId: '507f1f77bcf86cd799439011',
      reason: 'unknown',
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'notification:invalidated',
      expect.objectContaining({ reason: 'created' })
    );
  });
});
