const { isRedisConfigured } = require('../utils/bullmqConnection');
const { isCloudinaryConfigured } = require('../utils/cloudinary');
const { getWorkerStatus } = require('./jobQueue.service');
const { isPublicRegistrationDisabled } = require('./securityPolicy.service');

function check(label, ok, detail) {
  return { label, ok: Boolean(ok), detail: detail || (ok ? 'OK' : 'Needs attention') };
}

function getSecurityPosture() {
  const isProd = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL || '';
  const storageProvider = (process.env.STORAGE_PROVIDER || 'auto').toLowerCase();
  const worker = getWorkerStatus();

  const checks = [
    check('Production mode', isProd, isProd ? 'NODE_ENV=production' : 'Development mode'),
    check(
      'HTTPS frontend URL',
      !isProd || frontendUrl.startsWith('https://'),
      frontendUrl || 'FRONTEND_URL not set'
    ),
    check(
      'Strong JWT secret',
      !isProd ||
        (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'your-super-secret-jwt-key-123'),
      isProd ? 'JWT_SECRET configured' : 'Set in production'
    ),
    check(
      'Public registration locked',
      isPublicRegistrationDisabled(),
      isPublicRegistrationDisabled() ? 'Signup disabled' : 'Open signup enabled'
    ),
    check(
      'Virus scanning (ClamAV)',
      process.env.CLAMAV_ENABLED === 'true',
      process.env.CLAMAV_ENABLED === 'true' ? 'Enabled' : 'CLAMAV_ENABLED not true'
    ),
    check(
      'Message HTML sanitization',
      (process.env.MESSAGE_SANITIZER || '').toLowerCase() === 'dompurify',
      `MESSAGE_SANITIZER=${process.env.MESSAGE_SANITIZER || 'regex'}`
    ),
    check(
      'Metrics endpoint protected',
      !isProd || Boolean(process.env.METRICS_TOKEN),
      process.env.METRICS_TOKEN ? 'METRICS_TOKEN set' : 'Use METRICS_TOKEN in production'
    ),
    check(
      'Cloud file storage',
      storageProvider === 'cloudinary' || isCloudinaryConfigured(),
      `STORAGE_PROVIDER=${storageProvider}`
    ),
    check(
      'Redis configured',
      isRedisConfigured(),
      isRedisConfigured() ? 'REDIS_URL set' : 'Optional for small deploys'
    ),
    check(
      'Background job worker',
      worker.running || !isRedisConfigured(),
      worker.running ? `Running (${worker.mode})` : 'Start API server or worker'
    ),
  ];

  const passed = checks.filter((c) => c.ok).length;
  return {
    checks,
    summary: { passed, total: checks.length },
  };
}

module.exports = { getSecurityPosture };
