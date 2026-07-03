const { resolveJwtSecret, DEFAULT_DEV_JWT_SECRET } = require('../../../utils/jwtSecret');

describe('jwtSecret', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns dev fallback secret outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    expect(resolveJwtSecret()).toBe(DEFAULT_DEV_JWT_SECRET);
  });

  it('throws in production when JWT_SECRET is missing or default', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = DEFAULT_DEV_JWT_SECRET;
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
  });
});
