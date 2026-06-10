jest.mock('../../../utils/cache', () => ({
  getJson: jest.fn(),
  setJson: jest.fn(),
  delJson: jest.fn(),
  incr: jest.fn().mockResolvedValue(2),
  getNumber: jest.fn().mockResolvedValue(1),
}));

const cache = require('../../../utils/cache');
const inboxCache = require('../../../services/inboxCache.service');

describe('inboxCache.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.INBOX_CACHE_VERSION;
  });

  it('uses versioned conversation list keys', () => {
    expect(inboxCache.conversationListKey('u1', 'inbox')).toBe('inbox:v3:convos:u1:inbox');
  });

  it('buildMessageCacheKey embeds generation', async () => {
    cache.getNumber.mockResolvedValue(3);
    const key = await inboxCache.buildMessageCacheKey('u1', 'c1', 50, 'start');
    expect(key).toContain(':g3');
    expect(key).toContain('inbox:v3:msgs:');
  });

  it('invalidateAfterMessageChange bumps generation and clears lists', async () => {
    await inboxCache.invalidateAfterMessageChange('c1', ['u1', 'u2']);
    expect(cache.incr).toHaveBeenCalledWith('inbox:v3:msggen:c1');
    expect(cache.delJson).toHaveBeenCalled();
  });

  it('unreadTotalKey is versioned per user', () => {
    expect(inboxCache.unreadTotalKey('u1')).toBe('inbox:v3:unread:u1');
  });
});
