jest.mock('../../../models/Message', () => ({
  aggregate: jest.fn(),
  distinct: jest.fn(),
  countDocuments: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../../models/ConversationParticipant', () => ({
  collection: { collectionName: 'conversationparticipants' },
  updateOne: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({}),
  find: jest.fn(),
}));

const Message = require('../../../models/Message');
const ConversationParticipant = require('../../../models/ConversationParticipant');
const inboxUnread = require('../../../services/inboxUnread.service');

describe('inboxUnread.service', () => {
  const originalFlag = process.env.INBOX_DENORM_UNREAD;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INBOX_DENORM_UNREAD = 'true';
  });

  afterAll(() => {
    process.env.INBOX_DENORM_UNREAD = originalFlag;
  });

  it('recordMessageSent zeros sender unread and increments others', async () => {
    await inboxUnread.recordMessageSent({
      conversationId: 'c1',
      senderId: 'u1',
      messageId: 'm1',
    });

    expect(ConversationParticipant.updateOne).toHaveBeenCalledWith(
      { conversationId: 'c1', userId: 'u1' },
      expect.objectContaining({ $set: expect.objectContaining({ unreadCount: 0 }) }),
      undefined
    );
    expect(ConversationParticipant.updateMany).toHaveBeenCalledWith(
      { conversationId: 'c1', userId: { $ne: 'u1' } },
      expect.objectContaining({ $inc: { unreadCount: 1 } }),
      undefined
    );
  });

  it('always aggregates unread totals even when denorm flag is on', async () => {
    ConversationParticipant.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { conversationId: 'c1', unreadCount: 99, folder: 'inbox' },
      ]),
    });
    Message.distinct.mockResolvedValue(['c1']);
    Message.aggregate.mockResolvedValue([{ _id: 'c1', count: 2 }]);

    const total = await inboxUnread.getInboxUnreadTotal('u1');
    expect(total).toBe(2);
    expect(Message.aggregate).toHaveBeenCalled();
  });

  it('normalizes string user ids to ObjectId for aggregation lookups', () => {
    const id = '507f1f77bcf86cd799439011';
    const oid = inboxUnread.toObjectId(id);
    expect(String(oid)).toBe(id);
    expect(oid.constructor.name).toBe('ObjectId');
  });

  it('excludes sent-folder threads from the inbox badge total', async () => {
    ConversationParticipant.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { conversationId: 'c1', unreadCount: 0, folder: 'inbox' },
      ]),
    });
    Message.distinct.mockResolvedValue(['c1', 'c2']);
    Message.aggregate.mockResolvedValue([
      { _id: 'c1', count: 2 },
      { _id: 'c2', count: 5 },
    ]);

    const total = await inboxUnread.getInboxUnreadTotal('u1');
    expect(total).toBe(2);
    expect(ConversationParticipant.find).toHaveBeenCalledWith({
      userId: 'u1',
      folder: 'inbox',
    });
  });

  it('ignores drifted denorm unreadCount in favor of aggregation', async () => {
    process.env.INBOX_DENORM_UNREAD = 'false';
    ConversationParticipant.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { conversationId: 'c1', unreadCount: 99, folder: 'inbox' },
      ]),
    });
    Message.distinct.mockResolvedValue(['c1']);
    Message.aggregate.mockResolvedValue([{ _id: 'c1', count: 1 }]);

    const total = await inboxUnread.getInboxUnreadTotal('u1');
    expect(total).toBe(1);
    expect(Message.aggregate).toHaveBeenCalled();
  });
});
