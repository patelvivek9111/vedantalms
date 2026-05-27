jest.mock('../../models/discussionParticipation.model', () => ({
  updateOne: jest.fn(),
  updateMany: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  deleteMany: jest.fn(),
}));

jest.mock('../../models/discussionReply.model', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

const DiscussionParticipation = require('../../models/discussionParticipation.model');
const DiscussionReply = require('../../models/discussionReply.model');
const service = require('../../services/discussionParticipation.service');

describe('discussion participation tracking', () => {
  beforeEach(() => jest.clearAllMocks());

  it('increments author participation and unread counts for other participants on reply create', async () => {
    DiscussionParticipation.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ unreadCount: 0 }) });

    await service.recordReplyCreated({
      thread: { _id: 'thread1' },
      reply: { _id: 'reply1', createdAt: new Date('2026-01-01') },
      user: { _id: 'student1', role: 'student' },
      isRoot: true,
    });

    expect(DiscussionParticipation.updateOne).toHaveBeenCalledWith(
      { threadId: 'thread1', userId: 'student1' },
      expect.objectContaining({
        $set: expect.objectContaining({ hasPosted: true }),
        $inc: expect.objectContaining({ replyCount: 1, rootReplyCount: 1 }),
      }),
      { upsert: true }
    );
    expect(DiscussionParticipation.updateMany).toHaveBeenCalledWith(
      { threadId: 'thread1', userId: { $ne: 'student1' } },
      { $inc: { unreadCount: 1 } }
    );
  });

  it('marks a thread read using the latest reply timestamp', async () => {
    const latest = new Date('2026-02-01');
    DiscussionReply.findOne.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ createdAt: latest }),
    });
    DiscussionParticipation.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ unreadCount: 0 }) });

    await service.markThreadRead('thread1', 'student1');

    expect(DiscussionParticipation.updateOne).toHaveBeenCalledWith(
      { threadId: 'thread1', userId: 'student1' },
      expect.objectContaining({
        $set: expect.objectContaining({ unreadCount: 0, lastReadReplyCreatedAt: latest }),
      }),
      { upsert: true }
    );
  });
});
