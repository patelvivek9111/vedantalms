jest.mock('../../models/discussionReply.model', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
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

  it('soft-deletes a reply while keeping required content fields valid', async () => {
    const fileId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const doc = replyDoc({ fileAssets: [fileId], attachments: [fileId] });
    DiscussionReply.findOne.mockResolvedValue(doc);
    DiscussionReply.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
    });

    await replyService.softDeleteReply({
      thread: { _id: 'thread1' },
      replyId: 'reply1',
      user: { _id: 'student1' },
    });

    expect(doc.deletedAt).toBeInstanceOf(Date);
    expect(doc.content).toBe('[deleted]');
    expect(doc.sanitizedContent).toBeTruthy();
    expect(doc.editHistory[0].previousFileAssets).toEqual([fileId]);
    expect(doc.fileAssets).toEqual([]);
    expect(doc.save).toHaveBeenCalled();
  });

  it('restores file attachments after soft-delete', async () => {
    const fileId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const doc = replyDoc({
      deletedAt: new Date(),
      content: '[deleted]',
      sanitizedContent: '[deleted]',
      fileAssets: [],
      attachments: [],
      editHistory: [
        {
          previousContent: '<p>With file</p>',
          previousSanitizedContent: '<p>With file</p>',
          previousFileAssets: [fileId],
          previousAttachments: [fileId],
        },
      ],
    });
    DiscussionReply.findById.mockReturnValueOnce(Promise.resolve(doc)).mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
    });

    await replyService.restoreReply({ replyId: 'reply1', user: { _id: 'teacher1' } });

    expect(doc.fileAssets).toEqual([fileId]);
    expect(doc.attachments).toEqual([fileId]);
    expect(doc.content).toBe('<p>With file</p>');
    expect(doc.save).toHaveBeenCalled();
  });

  it('rejects liking your own reply', async () => {
    const doc = replyDoc({ likes: [], likeCount: 0 });
    DiscussionReply.findOne.mockResolvedValue(doc);

    await expect(
      replyService.toggleLike({
        thread: { _id: 'thread1' },
        replyId: 'reply1',
        user: { _id: 'student1' },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'SELF_LIKE_FORBIDDEN',
    });
    expect(doc.save).not.toHaveBeenCalled();
  });
});
