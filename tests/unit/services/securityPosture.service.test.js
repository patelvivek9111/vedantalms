const { getSecurityPosture } = require('../../../services/securityPosture.service');

describe('securityPosture.service', () => {
  const prev = {};

  beforeEach(() => {
    for (const key of [
      'NODE_ENV',
      'FRONTEND_URL',
      'JWT_SECRET',
      'CLAMAV_ENABLED',
      'MESSAGE_SANITIZER',
      'METRICS_TOKEN',
    ]) {
      prev[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('returns checklist matching admin posture endpoint shape', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.example.com';
    process.env.JWT_SECRET = 'not-the-default-secret-value';
    process.env.CLAMAV_ENABLED = 'true';
    process.env.MESSAGE_SANITIZER = 'dompurify';
    process.env.METRICS_TOKEN = 'metrics-token';

    const posture = getSecurityPosture();
    expect(posture.summary).toEqual(
      expect.objectContaining({
        passed: expect.any(Number),
        total: expect.any(Number),
      })
    );
    expect(Array.isArray(posture.checks)).toBe(true);
    expect(posture.checks.length).toBe(posture.summary.total);
    expect(posture.checks.every((c) => typeof c.label === 'string' && typeof c.ok === 'boolean')).toBe(
      true
    );
  });
});
