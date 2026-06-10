jest.mock('../../../models/Conversation', () => ({
  findByIdAndUpdate: jest.fn(),
  findById: jest.fn(),
  deleteOne: jest.fn()
}));

jest.mock('../../../models/Message', () => ({
  create: jest.fn(),
  deleteMany: jest.fn()
}));

jest.mock('../../../models/ConversationParticipant', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
  find: jest.fn(),
  distinct: jest.fn(),
  deleteOne: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../../../services/inboxUnread.service', () => ({
  isDenormUnreadEnabled: jest.fn().mockReturnValue(false),
  recordMessageSent: jest.fn().mockResolvedValue(undefined),
  markConversationRead: jest.fn().mockResolvedValue(undefined),
  aggregateUnreadByConversation: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('../../../services/messageAttachment.service', () => ({
  assertAttachmentInputs: jest.fn(),
  resolveMessageAttachments: jest.fn().mockResolvedValue({
    fileAssetIds: [],
    attachments: [],
  }),
}));

jest.mock('../../../services/participantPolicy.service', () => ({
  assertCanAddParticipants: jest.fn().mockResolvedValue({ policy: { enforced: false }, course: null }),
  assertSenderMayParticipateInConversation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../services/inboxCache.service', () => ({
  conversationListKey: jest.fn((userId, folder) => `inbox:v2:convos:${userId}:${folder || 'all'}`),
  buildMessageCacheKey: jest.fn().mockResolvedValue('inbox:v2:msgs:key'),
  getJson: jest.fn(),
  setJson: jest.fn(),
  invalidateConversationLists: jest.fn().mockResolvedValue(undefined),
  invalidateMessageCaches: jest.fn().mockResolvedValue(undefined),
  invalidateAfterMessageChange: jest.fn().mockResolvedValue(undefined),
  invalidateUnreadTotals: jest.fn().mockResolvedValue(undefined),
  unreadTotalKey: jest.fn((userId) => `inbox:v2:unread:${userId}`),
}));

jest.mock('../../../services/notification', () => ({
  createNotification: jest.fn().mockResolvedValue(true)
}));

const Conversation = require('../../../models/Conversation');
const Message = require('../../../models/Message');
const ConversationParticipant = require('../../../models/ConversationParticipant');
const inboxController = require('../../../controllers/inbox.controller');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/inbox.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sendMessage validates required body', async () => {
    const req = {
      params: { conversationId: '507f1f77bcf86cd799439011' },
      body: { body: '   ' },
      user: { _id: 'u1' }
    };
    const res = createRes();

    await inboxController.sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Message body is required' });
  });

  test('sendMessage blocks non-participants', async () => {
    ConversationParticipant.findOne.mockResolvedValue(null);

    const req = {
      params: { conversationId: '507f1f77bcf86cd799439011' },
      body: { body: 'Hello' },
      user: { _id: 'u1' }
    };
    const res = createRes();

    await inboxController.sendMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not a participant' });
  });

  test('sendMessage updates participant folders and returns sanitized message', async () => {
    const createdMessage = {
      _id: 'm1',
      body: 'Hello there',
      bodyHtml: 'Hello there',
      bodyText: 'Hello there',
    };
    ConversationParticipant.findOne.mockResolvedValue({ _id: 'cp1' });
    Conversation.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: 'c1', course: null }),
    });
    Message.create.mockResolvedValue(createdMessage);
    ConversationParticipant.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([{ userId: { _id: 'u2' } }])
    });
    ConversationParticipant.distinct.mockResolvedValue(['u1', 'u2']);

    const req = {
      params: { conversationId: '507f1f77bcf86cd799439011' },
      body: { body: 'Hello there' },
      user: { _id: 'u1', firstName: 'Jane', lastName: 'Doe' }
    };
    const res = createRes();

    await inboxController.sendMessage(req, res);

    expect(ConversationParticipant.updateOne).toHaveBeenCalledWith(
      { conversationId: '507f1f77bcf86cd799439011', userId: 'u1' },
      expect.objectContaining({ lastReadAt: expect.any(Date) })
    );
    expect(ConversationParticipant.updateMany).toHaveBeenCalledWith(
      { conversationId: '507f1f77bcf86cd799439011', userId: { $ne: 'u1' } },
      { folder: 'inbox' }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'm1',
        body: 'Hello there',
        bodyHtml: 'Hello there',
        bodyText: 'Hello there',
      })
    );
    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Hello there',
        bodyHtml: 'Hello there',
        bodyText: 'Hello there',
      })
    );
  });

  test('sendMessage strips script tags from stored body', async () => {
    ConversationParticipant.findOne.mockResolvedValue({ _id: 'cp1' });
    Conversation.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ course: null }),
    });
    Message.create.mockImplementation((doc) => Promise.resolve({ _id: 'm2', ...doc }));
    ConversationParticipant.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });
    ConversationParticipant.distinct.mockResolvedValue(['u1']);

    const req = {
      params: { conversationId: '507f1f77bcf86cd799439011' },
      body: { body: '<p>Hi</p><script>alert(1)</script>' },
      user: { _id: 'u1', firstName: 'Jane', lastName: 'Doe' },
    };
    const res = createRes();

    await inboxController.sendMessage(req, res);

    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.stringContaining('<script'),
        bodyText: 'Hi',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.stringContaining('<script'),
      })
    );
  });
});

