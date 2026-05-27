jest.mock('../../models/discussionParticipation.model', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../../models/discussionReply.model', () => ({
  findOne: jest.fn(),
}));

const DiscussionParticipation = require('../../models/discussionParticipation.model');
const readState = require('../../services/discussionParticipation.service');

describe('discussion read state', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a zeroed read-state row when none exists', async () => {
    DiscussionParticipation.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const state = await readState.getReadState('thread1', 'student1');

    expect(state).toMatchObject({
      threadId: 'thread1',
      userId: 'student1',
      hasPosted: false,
      unreadCount: 0,
    });
  });
});
