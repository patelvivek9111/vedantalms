jest.mock('../../models/discussionReply.model', () => ({
  findById: jest.fn(),
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
  recordReplyDeleted: jest.fn(),
  recordReplyEdited: jest.fn(),
  recordLike: jest.fn(),
}));

const DiscussionReply = require('../../models/discussionReply.model');
const replyService = require('../../services/discussionReply.service');

function replyDoc(overrides = {}) {
  return {
    _id: 'reply1',
    threadId: 'thread1',
    authorId: 'student1',
    content: '<p>Original</p>',
    sanitizedContent: '<p>Original</p>',
    moderation: {},
    editHistory: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('discussion moderation workflow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hides a reply without deleting historical content', async () => {
    const doc = replyDoc();
    DiscussionReply.findById.mockReturnValueOnce(Promise.resolve(doc)).mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
    });

    await replyService.hideReply({ replyId: 'reply1', user: { _id: 'teacher1' }, note: 'off topic' });

    expect(doc.moderationState).toBe('hidden');
    expect(doc.hiddenByModerator).toBe(true);
    expect(doc.content).toBe('<p>Original</p>');
    expect(doc.save).toHaveBeenCalled();
  });

  it('restores a hidden reply', async () => {
    const doc = replyDoc({ moderationState: 'hidden', hiddenByModerator: true, moderation: { hidden: true } });
    DiscussionReply.findById.mockReturnValueOnce(Promise.resolve(doc)).mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
    });

    await replyService.restoreReply({ replyId: 'reply1', user: { _id: 'teacher1' } });

    expect(doc.moderationState).toBe('active');
    expect(doc.hiddenByModerator).toBe(false);
    expect(doc.restoredBy).toBe('teacher1');
    expect(doc.save).toHaveBeenCalled();
  });
});
