const { getActiveProviders, getProviderCapabilities } = require('../../config/providers');

describe('provider registry (Phase P5)', () => {
  test('returns active provider keys', () => {
    const active = getActiveProviders();
    expect(active).toHaveProperty('storage');
    expect(active).toHaveProperty('cache');
    expect(active).toHaveProperty('queue');
  });

  test('capability registry has entries', () => {
    expect(getProviderCapabilities('memory').supportsTTL).toBe(true);
    expect(getProviderCapabilities('bullmq').supportsRetries).toBe(true);
  });
});
