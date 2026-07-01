/**
 * Fail-fast validation for production deployments (Phase M + P5).
 */
const { paths } = require('./paths');
const { getActiveProviders } = require('./providers');
const fs = require('fs');

function validateStartupEnv() {
  const errors = [];
  const warnings = [];
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-123') {
      errors.push('JWT_SECRET must be set to a strong secret in production');
    }
    if (!process.env.METRICS_TOKEN) {
      warnings.push('METRICS_TOKEN is not set — /metrics requires an admin JWT in production');
    }
    if (process.env.CLAMAV_ENABLED !== 'true') {
      warnings.push('CLAMAV_ENABLED is not true — file uploads are not virus-scanned');
    }
    if (process.env.MESSAGE_SANITIZER !== 'dompurify') {
      warnings.push('MESSAGE_SANITIZER is not dompurify — consider enabling for stronger XSS protection');
    }
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI is required in production');
    }
    if (process.env.REQUIRE_REDIS === 'true' && !process.env.REDIS_URL) {
      errors.push('REDIS_URL is required when REQUIRE_REDIS=true');
    }
    if (process.env.FORCE_OBJECT_STORAGE === 'true') {
      const { isCloudinaryConfigured } = require('../utils/cloudinary');
      if (!isCloudinaryConfigured()) {
        errors.push('FORCE_OBJECT_STORAGE=true but Cloudinary credentials are missing');
      }
    }
    if ((process.env.STORAGE_PROVIDER || 'auto') === 'local') {
      warnings.push('STORAGE_PROVIDER=local in production — use cloudinary for 2500+ concurrent users');
    }
    if (process.env.PREVIEW_STORAGE === 'cloudinary') {
      const { isCloudinaryConfigured } = require('../utils/cloudinary');
      if (!isCloudinaryConfigured()) {
        errors.push('PREVIEW_STORAGE=cloudinary but Cloudinary credentials are missing');
      }
    }
  }

  const allowedStorage = ['auto', 'local', 'cloudinary'];
  if (!allowedStorage.includes(process.env.STORAGE_PROVIDER || 'auto')) {
    errors.push(`STORAGE_PROVIDER must be one of: ${allowedStorage.join(', ')}`);
  }

  const allowedCache = ['auto', 'redis', 'memory'];
  if (!allowedCache.includes(process.env.CACHE_PROVIDER || 'auto')) {
    errors.push(`CACHE_PROVIDER must be one of: ${allowedCache.join(', ')}`);
  }

  [
    paths.uploads,
    paths.jobExports,
    paths.gradeArchives,
    paths.institutionExports,
    paths.migrationTemp,
    paths.migrationCheckpoints,
  ].forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      warnings.push(`Could not ensure directory ${dir}: ${e.message}`);
    }
  });

  if (process.env.DISABLE_MIGRATIONS === 'true' && isProd) {
    warnings.push('DISABLE_MIGRATIONS=true — ensure migrations were applied out of band');
  }

  const providers = getActiveProviders();
  if (isProd && providers.queue === 'inline' && process.env.REQUIRE_JOB_QUEUE === 'true') {
    errors.push('REQUIRE_JOB_QUEUE=true but queue resolved to inline');
  }

  if (warnings.length) {
    console.warn('Startup warnings:\n' + warnings.map((w) => `  - ${w}`).join('\n'));
  }

  if (errors.length) {
    console.error('Startup validation failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    if (isProd) process.exit(1);
  }
}

module.exports = { validateStartupEnv };
