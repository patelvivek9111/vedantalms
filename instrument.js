// Sentry must be initialized before any other module is imported.
// Safe no-op when SENTRY_DSN is not set (local/dev), so no noise is sent.
require('dotenv').config();

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  const Sentry = require('@sentry/node');
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    // Capture a small sample of performance traces; errors are always sent.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
}
