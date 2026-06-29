jest.mock('../../models/discussionReply.model', () => ({
  exists: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../../models/thread.model', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
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

function embeddedThreadQuery(replies = []) {
  const chain = {
    populate: jest.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve({ replies }).then(resolve, reject),
  };
  return {
    select: jest.fn().mockReturnValue(chain),
  };
}

function migratedLegacyQuery(ids = []) {
  return {
    select: () => ({
      lean: () => Promise.resolve(ids.map((id) => ({ legacyReplyId: id }))),
    }),
  };
}

describe('discussionReply.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    DiscussionReply.aggregate.mockResolvedValue([]);
  });

  it('uses collection pagination when no unmigrated embedded replies remain', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const rows = [
      { _id: 'reply1', threadId: 'thread1', authorId: 'student1', sanitizedContent: 'one', createdAt },
      { _id: 'reply2', threadId: 'thread1', authorId: 'student2', sanitizedContent: 'two', createdAt },
    ];
    DiscussionReply.exists.mockResolvedValue({ _id: 'reply1' });
    DiscussionReply.find.mockImplementation((filter) => {
      if (filter?.legacyReplyId) return migratedLegacyQuery();
      return queryResult(rows);
    });
    DiscussionReply.countDocuments.mockResolvedValue(2);
    Thread.findById.mockReturnValue(embeddedThreadQuery([]));

    const result = await discussionReplyService.listRootReplies({ _id: 'thread1' }, { limit: 1 });

    expect(result.source).toBe('collection');
    expect(result.replies).toHaveLength(1);
    expect(result.pagination.total).toBe(2);
    expect(DiscussionReply.find).toHaveBeenCalledWith(expect.objectContaining({
      threadId: 'thread1',
      parentReplyId: null,
      deletedAt: null,
    }));
  });

  it('excludes soft-deleted collection child replies', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    DiscussionReply.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'parent1',
        threadId: 'thread1',
      }),
    });
    DiscussionReply.find.mockImplementation((filter) => {
      if (filter?.legacyReplyId) return migratedLegacyQuery();
      if (filter?.parentReplyId === 'parent1' && filter?.deletedAt === null) {
        return queryResult([
          {
            _id: 'active-child',
            threadId: 'thread1',
            parentReplyId: 'parent1',
            authorId: 'student1',
            sanitizedContent: 'still here',
            createdAt,
          },
        ]);
      }
      return queryResult([]);
    });
    DiscussionReply.countDocuments.mockResolvedValue(1);
    Thread.findById.mockReturnValue(embeddedThreadQuery([]));

    const result = await discussionReplyService.listChildReplies('parent1', { limit: 50 });

    expect(result.source).toBe('collection');
    expect(result.replies.map((reply) => String(reply._id))).toEqual(['active-child']);
    expect(DiscussionReply.find).toHaveBeenCalledWith(expect.objectContaining({
      threadId: 'thread1',
      parentReplyId: 'parent1',
      deletedAt: null,
    }));
  });

  it('merges unmigrated embedded root replies when collection replies exist', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const collectionRows = [
      { _id: 'reply1', threadId: 'thread1', authorId: 'student1', sanitizedContent: 'new', createdAt },
    ];
    DiscussionReply.exists.mockResolvedValue({ _id: 'reply1' });
    DiscussionReply.find.mockImplementation((filter) => {
      if (filter?.legacyReplyId) return migratedLegacyQuery();
      return queryResult(collectionRows);
    });
    Thread.findById.mockReturnValue(
      embeddedThreadQuery([
        {
          _id: 'legacy1',
          author: { _id: 'student2' },
          content: '<p>legacy root</p>',
          createdAt: new Date('2025-12-01T00:00:00.000Z'),
          deletedAt: null,
        },
      ])
    );

    const result = await discussionReplyService.listRootReplies({ _id: 'thread1' }, { limit: 50 });

    expect(result.source).toBe('mixed');
    expect(result.replies.map((reply) => String(reply._id))).toEqual(['legacy1', 'reply1']);
    expect(result.pagination.total).toBe(2);
  });

  it('excludes embedded replies that were migrated into the collection', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    DiscussionReply.exists.mockResolvedValue({ _id: 'reply1' });
    DiscussionReply.find.mockImplementation((filter) => {
      if (filter?.legacyReplyId) return migratedLegacyQuery(['legacy1']);
      return queryResult([
        { _id: 'reply1', threadId: 'thread1', authorId: 'student1', sanitizedContent: 'migrated', createdAt },
      ]);
    });
    Thread.findById.mockReturnValue(
      embeddedThreadQuery([
        {
          _id: 'legacy1',
          author: { _id: 'student2' },
          content: '<p>legacy root</p>',
          createdAt,
          deletedAt: null,
        },
      ])
    );

    const result = await discussionReplyService.listRootReplies({ _id: 'thread1' }, { limit: 50 });

    expect(result.source).toBe('collection');
    expect(result.replies).toHaveLength(1);
    expect(String(result.replies[0]._id)).toBe('reply1');
  });

  it('returns legacy child replies for a legacy parent after collection replies exist', async () => {
    const createdAt = new Date('2026-01-02T00:00:00.000Z');
    DiscussionReply.findById.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    Thread.findOne.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ _id: 'thread1' }),
      }),
    });
    DiscussionReply.find.mockImplementation((filter) => {
      if (filter?.legacyReplyId) return migratedLegacyQuery();
      if (filter?.parentReplyId === 'legacy-root') {
        return queryResult([
          {
            _id: 'reply-nested',
            threadId: 'thread1',
            parentReplyId: 'legacy-root',
            authorId: 'student1',
            sanitizedContent: 'nested in collection',
            createdAt,
          },
        ]);
      }
      return queryResult([]);
    });
    Thread.findById.mockReturnValue(
      embeddedThreadQuery([
        {
          _id: 'legacy-root',
          author: { _id: 'student2' },
          content: '<p>legacy root</p>',
          createdAt: new Date('2025-12-01T00:00:00.000Z'),
          deletedAt: null,
        },
        {
          _id: 'legacy-child',
          author: { _id: 'student3' },
          parentReply: 'legacy-root',
          content: '<p>legacy child</p>',
          createdAt: new Date('2025-12-02T00:00:00.000Z'),
          deletedAt: null,
        },
      ])
    );

    const result = await discussionReplyService.listChildReplies('legacy-root', { limit: 50 });

    expect(result.source).toBe('mixed');
    expect(result.replies.map((reply) => String(reply._id))).toEqual(['legacy-child', 'reply-nested']);
    expect(result.pagination.total).toBe(2);
  });

  it('rejects createReply when parent depth exceeds MAX_REPLY_DEPTH', async () => {
    DiscussionReply.findOne.mockResolvedValue({
      _id: 'nested-parent',
      threadId: 'thread1',
      parentReplyId: 'root1',
      depth: 1,
      deletedAt: null,
    });

    await expect(
      discussionReplyService.createReply({
        thread: { _id: 'thread1', save: jest.fn() },
        user: { _id: 'student1' },
        content: '<p>Too deep</p>',
        parentReplyId: 'nested-parent',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'REPLY_DEPTH_EXCEEDED',
    });
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
