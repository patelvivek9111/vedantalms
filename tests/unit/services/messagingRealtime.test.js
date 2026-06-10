const messagingRealtime = require('../../../services/messagingRealtime.service');

describe('messagingRealtime.service', () => {
  const originalFlag = process.env.INBOX_WEBSOCKET_ENABLED;
  let mockEmit;

  beforeEach(() => {
    process.env.INBOX_WEBSOCKET_ENABLED = 'true';
    mockEmit = jest.fn();
    messagingRealtime.setMessagingNamespace({
      to: () => ({ emit: mockEmit }),
    });
  });

  afterAll(() => {
    process.env.INBOX_WEBSOCKET_ENABLED = originalFlag;
    messagingRealtime.setMessagingNamespace(null);
  });

  it('emits message:new to conversation room and unread to user rooms', async () => {
    await messagingRealtime.notifyMessageNew({
      conversationId: '507f1f77bcf86cd799439012',
      messageId: '507f1f77bcf86cd799439013',
      senderId: '507f1f77bcf86cd799439011',
      participantUserIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439014'],
    });
    expect(mockEmit).toHaveBeenCalled();
    const events = mockEmit.mock.calls.map((c) => c[0]);
    expect(events).toContain('messaging:message:new');
  });

  it('no-ops when websocket flag is disabled', async () => {
    process.env.INBOX_WEBSOCKET_ENABLED = 'false';
    mockEmit.mockClear();
    await messagingRealtime.notifyMessageNew({
      conversationId: 'c1',
      messageId: 'm1',
      senderId: 'u1',
      participantUserIds: ['u1', 'u2'],
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
