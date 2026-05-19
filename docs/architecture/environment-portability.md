# Environment Portability

Vedanta LMS is prepared for cross-provider migration without changing production behavior today. All filesystem and storage references are centralized and configurable.

## Path configuration

See `config/paths.js`. Override via environment variables:

| Variable | Purpose |
|----------|---------|
| `UPLOADS_DIR` | User uploads root |
| `JOB_EXPORTS_DIR` | Async gradebook export files |
| `GRADE_ARCHIVES_DIR` | Frozen snapshot archives |
| `INSTITUTION_EXPORTS_DIR` | Institution portable bundles |
| `MIGRATION_TEMP_DIR` | Temporary migration working files |
| `MIGRATION_CHECKPOINTS_DIR` | Resumable export/import checkpoints |

Paths are resolved relative to `process.cwd()` — never hardcode absolute host paths in business logic.

## Storage abstraction

`services/storage/index.js` exposes:

- `uploads` — course/submission files
- `exports` — job exports
- `archives` — grade snapshot archives
- `institutionExports` — full institution bundles

Provider selection: `STORAGE_PROVIDER=auto|local|cloudinary` in `config/providers.js`.

## Database

MongoDB connection uses `MONGODB_URI` only. No environment-specific collection names or host assumptions in application code.

## Deterministic operations

- Institution exports sort records by `_id` for reproducible bundles.
- Section export order is fixed in `shared/portability/sectionRegistry.cjs`.
- Demo seeds (`scripts/seed*`) use explicit dates and weights for repeatable environments.

## Secrets

Exports strip passwords, tokens, SMTP passwords, enrollment QR/join codes, and download tokens. Restores never import credentials — operators must re-issue secrets in the target environment.

## Related commands

```bash
npm run export:institution
npm run verify:institution-export -- uploads/exports/institution/<batchId>
npm run verify:backup-compatibility -- uploads/exports/institution/<batchId>
npm run verify:data-integrity
```
