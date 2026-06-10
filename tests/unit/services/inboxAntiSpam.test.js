const messageAudit = require('../../../services/messageAudit.service');
const inboxAntiSpam = require('../../../services/inboxAntiSpam.service');

describe('inboxAntiSpam.service', () => {
  const originalFlag = process.env.INBOX_ANTISPAM_ENFORCED;

  beforeEach(() => {
    process.env.INBOX_ANTISPAM_ENFORCED = 'true';
    process.env.INBOX_MAX_MESSAGES_PER_MINUTE = '2';
    process.env.INBOX_DUPLICATE_WINDOW_SEC = '120';
  });

  afterAll(() => {
    process.env.INBOX_ANTISPAM_ENFORCED = originalFlag;
  });

  it('blocks duplicate messages in the same conversation', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const conversationId = '507f1f77bcf86cd799439012';
    await inboxAntiSpam.assertCanSendMessage(userId, {
      conversationId,
      bodyText: 'Hello there',
    });
    await expect(
      inboxAntiSpam.assertCanSendMessage(userId, {
        conversationId,
        bodyText: 'Hello there',
      })
    ).rejects.toMatchObject({ code: 'INBOX_DUPLICATE_MESSAGE', statusCode: 429 });
  });

  it('no-ops when anti-spam flag is off', async () => {
    process.env.INBOX_ANTISPAM_ENFORCED = 'false';
    await expect(
      inboxAntiSpam.assertCanSendMessage('u1', {
        conversationId: 'c1',
        bodyText: 'same',
      })
    ).resolves.toBeUndefined();
    await expect(
      inboxAntiSpam.assertCanSendMessage('u1', {
        conversationId: 'c1',
        bodyText: 'same',
      })
    ).resolves.toBeUndefined();
  });

  it('records spam audit on violation handler', async () => {
    const recordSpy = jest.spyOn(messageAudit, 'recordSpamBlocked').mockResolvedValue(null);
    const err = new Error('blocked');
    err.code = 'INBOX_SEND_RATE';
    await inboxAntiSpam.handleSpamViolation(
      { params: { conversationId: 'c1' }, user: { _id: 'u1' } },
      err
    );
    expect(recordSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code: 'INBOX_SEND_RATE', conversationId: 'c1' })
    );
    recordSpy.mockRestore();
  });
});
