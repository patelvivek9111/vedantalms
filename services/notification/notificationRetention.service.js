/**
 * Retention policy groundwork for in-app notifications.
 * TTL deletion only occurs when expiresAt is set (Mongo TTL index on Notification).
 */

const EPHEMERAL_TTL_DAYS = {
  message: 90,
  announcement: 180,
  assignment_due: 30,
  discussion: 120,
};

/** Types treated as longer-lived / institutional record signals — no automatic TTL by default. */
const NO_AUTO_TTL_TYPES = new Set([
  'grade',
  'assignment_graded',
  'enrollment',
  'submission',
  'system',
]);

function isRetentionDefaultsEnabled() {
  return process.env.NOTIFICATION_RETENTION_ENABLED === 'true';
}

function getDefaultTtlDaysForType(type) {
  if (!type || NO_AUTO_TTL_TYPES.has(type)) return null;
  return EPHEMERAL_TTL_DAYS[type] ?? null;
}

function resolveDefaultExpiresAt(type, now = new Date()) {
  if (!isRetentionDefaultsEnabled()) return null;
  if (type == null) return null;

  const days = getDefaultTtlDaysForType(type);
  if (!days) return null;

  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function getRetentionPolicySummary() {
  return {
    enabled: isRetentionDefaultsEnabled(),
    ephemeralTtlDays: { ...EPHEMERAL_TTL_DAYS },
    noAutoTtlTypes: [...NO_AUTO_TTL_TYPES],
    note: 'expiresAt must be set for Mongo TTL index to purge rows; no automatic purge of legacy rows without expiresAt',
  };
}

module.exports = {
  isRetentionDefaultsEnabled,
  getDefaultTtlDaysForType,
  resolveDefaultExpiresAt,
  getRetentionPolicySummary,
  EPHEMERAL_TTL_DAYS,
  NO_AUTO_TTL_TYPES,
};
