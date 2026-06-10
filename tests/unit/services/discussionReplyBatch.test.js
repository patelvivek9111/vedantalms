jest.mock('../../../models/discussionReply.model', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../../models/thread.model', () => ({
  find: jest.fn(),
}));

const mongoose = require('mongoose');
const DiscussionReply = require('../../../models/discussionReply.model');
const Thread = require('../../../models/thread.model');
const { batchThreadIdsRepliedByUser } = require('../../../services/discussionReply.service');

describe('discussionReply.service batchThreadIdsRepliedByUser', () => {
  const userId = new mongoose.Types.ObjectId();
  const threadA = new mongoose.Types.ObjectId();
  const threadB = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns thread ids with collection replies', async () => {
    DiscussionReply.aggregate.mockResolvedValue([{ _id: threadA }]);
    Thread.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const replied = await batchThreadIdsRepliedByUser([threadA], userId);
    expect(replied.has(String(threadA))).toBe(true);
    expect(Thread.find).not.toHaveBeenCalled();
  });

  it('checks embedded replies for threads without collection hits', async () => {
    DiscussionReply.aggregate.mockResolvedValue([]);
    Thread.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: threadB,
          replies: [{ author: userId, deletedAt: null }],
        },
      ]),
    });

    const replied = await batchThreadIdsRepliedByUser([threadB], userId);
    expect(replied.has(String(threadB))).toBe(true);
  });
});
