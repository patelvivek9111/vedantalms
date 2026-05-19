/**
 * Provider configuration (Phase P5) — environment-driven, single active provider per category.
 * No multi-cloud wiring; preparation for future swaps only.
 */

const PROVIDERS = {
  storage: process.env.STORAGE_PROVIDER || 'auto', // auto | local | cloudinary
  cache: process.env.CACHE_PROVIDER || 'auto', // auto | redis | memory
  queue: process.env.QUEUE_PROVIDER || 'auto', // auto | bullmq | inline
  export: process.env.EXPORT_PROVIDER || 'local', // local (filesystem manifests)
};

const CAPABILITIES = {
  local: {
    supportsSignedUrls: false,
    supportsStreamingExports: false,
    supportsVersioning: false,
    supportsLifecycleRules: false,
  },
  cloudinary: {
    supportsSignedUrls: false,
    supportsStreamingExports: false,
    supportsVersioning: false,
    supportsLifecycleRules: false,
  },
  redis: {
    supportsDistributedLocks: true,
    supportsTTL: true,
  },
  memory: {
    supportsDistributedLocks: false,
    supportsTTL: true,
  },
  bullmq: {
    supportsRetries: true,
    supportsDeadLetter: false,
    supportsDelayedJobs: true,
  },
  inline: {
    supportsRetries: false,
    supportsDeadLetter: false,
    supportsDelayedJobs: false,
  },
};

function resolveStorageProvider() {
  if (PROVIDERS.storage === 'local') return 'local';
  if (PROVIDERS.storage === 'cloudinary') return 'cloudinary';
  const { isCloudinaryConfigured } = require('../utils/cloudinary');
  return isCloudinaryConfigured() ? 'cloudinary' : 'local';
}

function resolveCacheProvider() {
  if (PROVIDERS.cache === 'memory') return 'memory';
  if (PROVIDERS.cache === 'redis') return 'redis';
  const { isRedisConfigured } = require('../utils/bullmqConnection');
  return isRedisConfigured() ? 'redis' : 'memory';
}

function resolveQueueProvider() {
  if (PROVIDERS.queue === 'inline') return 'inline';
  if (PROVIDERS.queue === 'bullmq') return 'bullmq';
  const { isRedisConfigured } = require('../utils/bullmqConnection');
  return isRedisConfigured() && process.env.FORCE_INLINE_JOBS !== 'true' ? 'bullmq' : 'inline';
}

function getProviderCapabilities(providerKey) {
  return CAPABILITIES[providerKey] || {};
}

function getActiveProviders() {
  return {
    storage: resolveStorageProvider(),
    cache: resolveCacheProvider(),
    queue: resolveQueueProvider(),
    export: PROVIDERS.export,
  };
}

module.exports = {
  PROVIDERS,
  CAPABILITIES,
  resolveStorageProvider,
  resolveCacheProvider,
  resolveQueueProvider,
  getProviderCapabilities,
  getActiveProviders,
};
