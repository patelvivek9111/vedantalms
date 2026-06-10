jest.mock('../../../services/academicAudit.service', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue({ _id: 'audit-1' }),
}));

const academicAudit = require('../../../services/academicAudit.service');
const messageAudit = require('../../../services/messageAudit.service');

describe('messageAudit.service', () => {
  const originalEnabled = process.env.INBOX_AUDIT_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INBOX_AUDIT_ENABLED = 'true';
    delete process.env.INBOX_AUDIT_READ_EVENTS;
  });

  afterAll(() => {
    process.env.INBOX_AUDIT_ENABLED = originalEnabled;
  });

  const req = {
    user: { _id: '507f1f77bcf86cd799439011', role: 'teacher' },
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/inbox/conversations',
    params: {},
  };

  it('records message sent when audit enabled', async () => {
    await messageAudit.recordMessageSent(req, {
      conversationId: '507f1f77bcf86cd799439012',
      messageId: '507f1f77bcf86cd799439013',
      attachmentCount: 2,
    });
    expect(academicAudit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inbox_message_sent',
        entityType: 'message',
        metadata: expect.objectContaining({ subsystem: 'inbox', attachmentCount: 2 }),
      })
    );
  });

  it('skips audit when flag is off', async () => {
    process.env.INBOX_AUDIT_ENABLED = 'false';
    await messageAudit.recordMessageSent(req, {
      conversationId: 'c1',
      messageId: 'm1',
    });
    expect(academicAudit.recordAuditEvent).not.toHaveBeenCalled();
  });

  it('skips read events unless INBOX_AUDIT_READ_EVENTS=true', async () => {
    await messageAudit.recordConversationRead(req, { conversationId: 'c1' });
    expect(academicAudit.recordAuditEvent).not.toHaveBeenCalled();

    process.env.INBOX_AUDIT_READ_EVENTS = 'true';
    await messageAudit.recordConversationRead(req, { conversationId: 'c1' });
    expect(academicAudit.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'inbox_conversation_read' })
    );
  });
});
