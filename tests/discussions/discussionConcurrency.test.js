jest.mock('../../models/discussionReply.model', () => ({
  exists: jest.fn(),
  find: jest.fn(),
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

jest.mock('../../services/discussionParticipation.service', () => ({
  recordReplyCreated: jest.fn(),
  recordReplyEdited: jest.fn(),
  recordReplyDeleted: jest.fn(),
  recordLike: jest.fn(),
}));

const DiscussionReply = require('../../models/discussionReply.model');
const counters = require('../../services/discussionCounter.service');
const participation = require('../../services/discussionParticipation.service');
const replyService = require('../../services/discussionReply.service');

function queryDoc(doc) {
  return {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(doc),
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  };
}

function makeReply(overrides = {}) {
  return {
    _id: overrides._id || 'reply1',
    threadId: overrides.threadId || 'thread1',
    authorId: overrides.authorId || 'student1',
    parentReplyId: overrides.parentReplyId || null,
    content: overrides.content || '<p>Reply</p>',
    sanitizedContent: overrides.sanitizedContent || '<p>Reply</p>',
    depth: overrides.depth || 0,
    likes: overrides.likes || [],
    likeCount: overrides.likeCount || 0,
    moderation: overrides.moderation || {},
    editHistory: overrides.editHistory || [],
    save: jest.fn().mockResolvedValue(undefined),
    createdAt: overrides.createdAt || new Date(),
    ...overrides,
  };
}

describe('discussion concurrency and consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('suppresses duplicate concurrent reply submissions after unique index rejection', async () => {
    const inserted = makeReply({ _id: 'reply-inserted' });
    DiscussionReply.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(inserted);
    DiscussionReply.create
      .mockResolvedValueOnce(inserted)
      .mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: 11000 }));
    DiscussionReply.findById.mockImplementation(() => queryDoc(inserted));

    const [first, second] = await Promise.all([
      replyService.createReply({
        thread: { _id: 'thread1' },
        user: { _id: 'student1', role: 'student' },
        content: '<p>Same</p>',
        idempotencyKey: 'same-key',
      }),
      replyService.createReply({
        thread: { _id: 'thread1' },
        user: { _id: 'student1', role: 'student' },
        content: '<p>Same</p>',
        idempotencyKey: 'same-key',
      }),
    ]);

    expect(first.duplicateSuppressed).toBe(false);
    expect(second.duplicateSuppressed).toBe(true);
    expect(counters.incrementReplyCreated).toHaveBeenCalledTimes(1);
    expect(participation.recordReplyCreated).toHaveBeenCalledTimes(1);
  });

  it('keeps like count consistent across like/unlike operations', async () => {
    const reply = makeReply({ likes: [], likeCount: 0 });
    DiscussionReply.findOne.mockResolvedValue(reply);
    DiscussionReply.findById.mockImplementation(() => queryDoc(reply));

    await replyService.toggleLike({
      thread: { _id: 'thread1' },
      replyId: 'reply1',
      user: { _id: 'student1' },
    });
    expect(reply.likeCount).toBe(1);
    expect(reply.likes).toHaveLength(1);
    expect(counters.updateLikeCount).toHaveBeenLastCalledWith('thread1', 'reply1', 1);

    await replyService.toggleLike({
      thread: { _id: 'thread1' },
      replyId: 'reply1',
      user: { _id: 'student1' },
    });
    expect(reply.likeCount).toBe(0);
    expect(reply.likes).toHaveLength(0);
    expect(counters.updateLikeCount).toHaveBeenLastCalledWith('thread1', 'reply1', -1);
  });

  it('preserves moderation consistency across hide and restore', async () => {
    const reply = makeReply({ moderationState: 'active', hiddenByModerator: false });
    DiscussionReply.findById.mockImplementation(() => queryDoc(reply));

    await replyService.hideReply({ replyId: 'reply1', user: { _id: 'teacher1' }, note: 'reviewed' });
    expect(reply.moderationState).toBe('hidden');
    expect(reply.hiddenByModerator).toBe(true);
    expect(reply.moderation.lastAction).toBe('hidden');

    await replyService.restoreReply({ replyId: 'reply1', user: { _id: 'teacher1' } });
    expect(reply.moderationState).toBe('active');
    expect(reply.hiddenByModerator).toBe(false);
    expect(reply.moderation.lastAction).toBe('restored');
  });
});
