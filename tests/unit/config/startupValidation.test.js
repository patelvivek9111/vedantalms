describe('startup env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('warns when production security hardening env vars are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'strong-production-secret';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lms';
    delete process.env.METRICS_TOKEN;
    delete process.env.CLAMAV_ENABLED;
    process.env.MESSAGE_SANITIZER = 'regex';
    delete process.env.DISABLE_PUBLIC_REGISTRATION;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { validateStartupEnv } = require('../../../config/startupValidation');

    validateStartupEnv();

    const warnings = warnSpy.mock.calls.flat().join('\n');
    expect(warnings).toContain(
      'METRICS_TOKEN is not set - /metrics, /health/ops, and /health/dependencies require an admin JWT in production'
    );
    expect(warnings).toContain('CLAMAV_ENABLED is not true');
    expect(warnings).toContain('MESSAGE_SANITIZER is not dompurify');
    expect(warnings).toContain('DISABLE_PUBLIC_REGISTRATION is not true');

    warnSpy.mockRestore();
  });

  it('blocks production startup with default JWT secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'your-super-secret-jwt-key-123';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lms';

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    const { validateStartupEnv } = require('../../../config/startupValidation');

    expect(() => validateStartupEnv()).toThrow('process.exit');
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
