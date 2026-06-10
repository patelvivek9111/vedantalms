const {
  isRetentionDefaultsEnabled,
  getDefaultTtlDaysForType,
  resolveDefaultExpiresAt,
  EPHEMERAL_TTL_DAYS,
} = require('../../../services/notification/notificationRetention.service');

describe('notificationRetention.service', () => {
  const originalFlag = process.env.NOTIFICATION_RETENTION_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.NOTIFICATION_RETENTION_ENABLED;
    } else {
      process.env.NOTIFICATION_RETENTION_ENABLED = originalFlag;
    }
  });

  it('is disabled by default', () => {
    delete process.env.NOTIFICATION_RETENTION_ENABLED;
    expect(isRetentionDefaultsEnabled()).toBe(false);
    expect(resolveDefaultExpiresAt('message')).toBeNull();
  });

  it('returns TTL days for ephemeral types', () => {
    expect(getDefaultTtlDaysForType('message')).toBe(EPHEMERAL_TTL_DAYS.message);
    expect(getDefaultTtlDaysForType('grade')).toBeNull();
    expect(getDefaultTtlDaysForType('system')).toBeNull();
  });

  it('resolves expiresAt when flag enabled', () => {
    process.env.NOTIFICATION_RETENTION_ENABLED = 'true';
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiresAt = resolveDefaultExpiresAt('message', now);

    expect(expiresAt).toBeInstanceOf(Date);
    const expectedMs = now.getTime() + 90 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBe(expectedMs);
  });

  it('does not set TTL for institutional types when enabled', () => {
    process.env.NOTIFICATION_RETENTION_ENABLED = 'true';
    expect(resolveDefaultExpiresAt('grade')).toBeNull();
    expect(resolveDefaultExpiresAt('submission')).toBeNull();
  });
});
