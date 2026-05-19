# Portability strategy (Phase P)

## Intent

Prepare Vedanta LMS for **future** migration (AWS, Azure, GCP, self-hosted, Docker) **without** changing the current affordable stack (MongoDB Atlas, existing Redis, current hosting).

## What is abstracted

| Layer | Facade | Adapters |
|-------|--------|----------|
| Storage | `services/storage/` | `local`, `cloudinary` (current) |
| Cache | `services/cache/` | `redis`, `memory` |
| Jobs | `services/jobs/` | `bullmq` (delegates to existing queue) |
| Paths | `config/paths.js` | Env-overridable directories |
| Providers | `config/providers.js` | Capability registry |

## What is NOT abstracted (by design)

- MongoDB / Mongoose models (stay on Atlas until a dedicated migration project)
- Grading engine (`shared/grading`)
- Transcript snapshot guarantees
- Lifecycle + audit append-only rules

## Environment variables

```bash
STORAGE_PROVIDER=auto|local|cloudinary
CACHE_PROVIDER=auto|redis|memory
QUEUE_PROVIDER=auto|bullmq|inline
UPLOADS_DIR=...
JOB_EXPORTS_DIR=...
```

## Future paths

- **AWS:** add `S3StorageAdapter`, set `STORAGE_PROVIDER=s3` (not implemented yet)
- **Self-host:** `STORAGE_PROVIDER=local`, Docker compose from `docker-compose.prod.yml`
- **Queue swap:** implement new adapter behind `services/jobs/`
