# Provider abstraction

## Entry points

```javascript
const { getStorageService } = require('./services/storage');
const { getCacheService } = require('./services/cache');
const { getJobQueueService } = require('./services/jobs');
const { getActiveProviders } = require('./config/providers');
```

## Capability registry

`getProviderCapabilities('redis')` → `{ supportsDistributedLocks, supportsTTL }`

Use before enabling features that require signed URLs, streaming exports, etc.

## Adding a new storage provider

1. Create `adapters/storage/s3StorageAdapter.js` implementing upload/read/delete surface
2. Register in `services/storage/index.js` `createStorageAdapter`
3. Set `STORAGE_PROVIDER=s3` when ready — no grading code changes
