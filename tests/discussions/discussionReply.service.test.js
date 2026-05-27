jest.mock('../../models/discussionReply.model', () => ({
  exists: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../models/thread.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../services/discussionCounter.service', () => ({
  incrementReplyCreated: jest.fn(),
  incrementReplyDeleted: jest.fn(),
  updateLikeCount: jest.fn(),
}));

const DiscussionReply = require('../../models/discussionReply.model');
const Thread = require('../../models/thread.model');
const discussionReplyService = require('../../services/discussionReply.service');

function queryResult(rows) {
  const query = {
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    populate: jest.fn(() => query),
    then: (resolve) => Promise.resolve(rows).then(resolve),
    catch: (reject) => Promise.resolve(rows).catch(reject),
  };
  return query;
}

describe('discussionReply.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pages root replies from the collection without scanning embedded replies', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const rows = [
      { _id: 'reply1', threadId: 'thread1', authorId: 'student1', sanitizedContent: 'one', createdAt },
      { _id: 'reply2', threadId: 'thread1', authorId: 'student2', sanitizedContent: 'two', createdAt },
    ];
    DiscussionReply.exists.mockResolvedValue({ _id: 'reply1' });
    DiscussionReply.find.mockReturnValue(queryResult(rows));
    DiscussionReply.countDocuments.mockResolvedValue(2);

    const result = await discussionReplyService.listRootReplies(
      { _id: 'thread1', replies: [{ _id: 'legacy1' }] },
      { limit: 1 }
    );

    expect(result.source).toBe('collection');
    expect(result.replies).toHaveLength(1);
    expect(result.pagination.total).toBe(2);
    expect(DiscussionReply.find).toHaveBeenCalledWith(expect.objectContaining({
      threadId: 'thread1',
      parentReplyId: null,
    }));
  });

  it('falls back to legacy embedded replies for submission checks before migration', async () => {
    DiscussionReply.exists.mockResolvedValue(null);
    Thread.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          replies: [
            { _id: 'reply1', author: 'student1', deletedAt: null },
            { _id: 'reply2', author: 'student2', deletedAt: new Date() },
          ],
        }),
      }),
    });

    await expect(discussionReplyService.hasReplyByUser('thread1', 'student1')).resolves.toBe(true);
    await expect(discussionReplyService.hasReplyByUser('thread1', 'student2')).resolves.toBe(false);
  });
});
