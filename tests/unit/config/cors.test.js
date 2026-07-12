const {
  getProductionOrigins,
  isLocalDevOrigin,
  isOriginAllowed,
  parseExtraOrigins,
} = require('../../../config/cors');

describe('CORS origin policy', () => {
  const prodEnv = {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://app.example.com',
    CORS_EXTRA_ORIGINS: 'https://staging.example.com,https://preview.example.com',
  };

  it('allows configured production frontend origins', () => {
    expect(
      isOriginAllowed('https://app.example.com', { nodeEnv: 'production', env: prodEnv })
    ).toBe(true);
    expect(
      isOriginAllowed('https://staging.example.com', { nodeEnv: 'production', env: prodEnv })
    ).toBe(true);
  });

  it('allows default production domains', () => {
    expect(
      isOriginAllowed('https://mysl8te.com', { nodeEnv: 'production', env: { NODE_ENV: 'production' } })
    ).toBe(true);
    expect(
      isOriginAllowed('https://vedantaed.com', { nodeEnv: 'production', env: { NODE_ENV: 'production' } })
    ).toBe(true);
  });

  it('rejects untrusted production origins', () => {
    expect(
      isOriginAllowed('https://evil.onrender.com', { nodeEnv: 'production', env: prodEnv })
    ).toBe(false);
    expect(
      isOriginAllowed('https://evil.vercel.app', { nodeEnv: 'production', env: prodEnv })
    ).toBe(false);
    expect(isOriginAllowed('https://malicious.example', { nodeEnv: 'production', env: prodEnv })).toBe(
      false
    );
  });

  it('allows localhost origins in development', () => {
    expect(isLocalDevOrigin('http://localhost:5173', 'development')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3000', { nodeEnv: 'development' })).toBe(true);
  });

  it('allows preview deploy origins only outside production', () => {
    expect(isOriginAllowed('https://branch-123.vercel.app', { nodeEnv: 'development' })).toBe(true);
    expect(
      isOriginAllowed('https://branch-123.vercel.app', { nodeEnv: 'production', env: prodEnv })
    ).toBe(false);
  });

  it('parses extra production origins from env', () => {
    expect(parseExtraOrigins('https://a.test, https://b.test')).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
    expect(getProductionOrigins(prodEnv)).toEqual(
      expect.arrayContaining([
        'https://app.example.com',
        'https://staging.example.com',
        'https://preview.example.com',
        'https://mysl8te.com',
        'https://vedantaed.com',
      ])
    );
  });
});
