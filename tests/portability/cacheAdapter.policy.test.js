const { MemoryCacheAdapter } = require('../../adapters/cache/memoryCacheAdapter');

describe('MemoryCacheAdapter (portability)', () => {
  test('set/get/del roundtrip', async () => {
    const cache = new MemoryCacheAdapter();
    await cache.set('k1', 'v1', 60);
    expect(await cache.get('k1')).toBe('v1');
    await cache.del('k1');
    expect(await cache.get('k1')).toBeNull();
  });

  test('ttl expires entries', async () => {
    const cache = new MemoryCacheAdapter();
    await cache.set('short', 'x', 1);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await cache.get('short')).toBeNull();
  });
});
