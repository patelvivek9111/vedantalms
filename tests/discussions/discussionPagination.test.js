jest.mock('../../models/discussionReply.model', () => ({
  exists: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/thread.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../services/discussionCounter.service', () => ({}));
jest.mock('../../services/discussionParticipation.service', () => ({}));

const DiscussionReply = require('../../models/discussionReply.model');
const service = require('../../services/discussionReply.service');

function queryResult(rows) {
  const query = {
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    populate: jest.fn(() => query),
    then: (resolve) => Promise.resolve(rows).then(resolve),
  };
  return query;
}

describe('discussion pagination', () => {
  beforeEach(() => jest.clearAllMocks());

  it('caps page size at 100 and returns a cursor when more rows exist', async () => {
    DiscussionReply.exists.mockResolvedValue({ _id: 'r1' });
    const rows = Array.from({ length: 101 }, (_, index) => ({
      _id: `0000000000000000000000${String(index).padStart(2, '0')}`.slice(-24),
      authorId: 'student1',
      createdAt: new Date(2026, 0, 1, 0, 0, index),
      sanitizedContent: `Reply ${index}`,
    }));
    DiscussionReply.find.mockReturnValue(queryResult(rows));
    DiscussionReply.countDocuments.mockResolvedValue(150);

    const result = await service.listRootReplies({ _id: 'thread1' }, { limit: 500 });

    expect(result.replies).toHaveLength(100);
    expect(result.pagination.limit).toBe(100);
    expect(result.pagination.nextCursor).toBeTruthy();
  });
});
