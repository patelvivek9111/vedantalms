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

jest.mock('../../../utils/cache', () => ({
  getJson: jest.fn(),
  setJson: jest.fn(),
  delJson: jest.fn()
}));

jest.mock('../../../routes/notification.routes', () => ({
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

  test('sendMessage updates participant folders and returns created message', async () => {
    const createdMessage = { _id: 'm1', body: 'Hello there' };
    ConversationParticipant.findOne.mockResolvedValue({ _id: 'cp1' });
    Message.create.mockResolvedValue(createdMessage);
    ConversationParticipant.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([{ userId: { _id: 'u2' } }])
    });
    ConversationParticipant.distinct.mockResolvedValue(['u1', 'u2']);
    Conversation.findById.mockResolvedValue({ _id: 'c1', subject: 'subj' });

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
    expect(res.json).toHaveBeenCalledWith(createdMessage);
  });
});

