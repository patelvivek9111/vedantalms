# Architecture

Portability, export/import, storage abstraction, and cross-cutting workflow design.

---

## Environment portability

All filesystem and storage references are centralized in `config/paths.js`:

| Variable | Purpose |
|----------|---------|
| `UPLOADS_DIR` | User uploads root |
| `JOB_EXPORTS_DIR` | Async gradebook export files |
| `GRADE_ARCHIVES_DIR` | Frozen snapshot archives |
| `INSTITUTION_EXPORTS_DIR` | Institution portable bundles |
| `MIGRATION_TEMP_DIR` | Migration working files |
| `MIGRATION_CHECKPOINTS_DIR` | Resumable checkpoints |

Paths resolve relative to `process.cwd()` — never hardcode absolute host paths in business logic.

**Database:** `MONGODB_URI` only; no environment-specific collection names in app code.

**Deterministic exports:** records sorted by `_id`; fixed section order in `shared/portability/sectionRegistry.cjs`.

**Secrets:** exports strip passwords, tokens, SMTP passwords, join codes, download tokens. Operators re-issue secrets in target environment.

---

## Provider abstraction

```javascript
const { getStorageService } = require('./services/storage');
const { getCacheService } = require('./services/cache');
const { getJobQueueService } = require('./services/jobs');
const { getActiveProviders } = require('./config/providers');
```

| Layer | Facade | Adapters |
|-------|--------|----------|
| Storage | `services/storage/` | `local`, `cloudinary` |
| Cache | `services/cache/` | `redis`, `memory` |
| Jobs | `services/jobs/` | `bullmq`, `inline` |

```bash
STORAGE_PROVIDER=auto|local|cloudinary
CACHE_PROVIDER=auto|redis|memory
QUEUE_PROVIDER=auto|bullmq|inline
```

`getProviderCapabilities('redis')` → feature gates (distributed locks, TTL).

**Adding S3:** implement `adapters/storage/s3StorageAdapter.js`, register in `createStorageAdapter`, set `STORAGE_PROVIDER=s3`.

**Not abstracted (by design):** MongoDB/Mongoose models, grading engine, transcript snapshot guarantees, lifecycle append-only rules.

---

## Institutional export

**Service:** `services/export/institutionalExport.service.js`  
**Registry:** `shared/portability/sectionRegistry.cjs`  
**Manifest:** `shared/portability/exportManifest.cjs` — version `2.0.0`, per-section `contentHash`, SHA-256 checksum

**Sections (JSON):** `systemSettings`, `users`, `courses`, `enrollments`, `modules`, `pages`, `assignments`, `submissions`, `quizzes`, `discussions`, `announcements`, `polls`, `groups`, `groupSets`, `meetings`, `attendance`, institution/course policies, `gradeSnapshots`, `transcriptSnapshots`, `lifecycleRecords`, `amendments`, `policyAudits`, `systemAudit`, `asyncJobs`, notifications, `calendarEvents`, `uploadsMetadata`, `permissionsRoles`

**Chunking:** 500 records per file; `checkpoint.json` for resume; `--sections=name1,name2` for partial export.

```bash
npm run export:institution
node scripts/exportInstitutionBundle.js --sections=users,courses
npm run verify:institution-export -- uploads/exports/institution/<batchId>
```

**Import:** `services/import/institutionalImport.service.js` — see [operations.md](./operations.md) restore section.

---

## Backup architecture

| Layer | Tool |
|-------|------|
| Grade snapshots | `services/backup/snapshotArchive.service.js` |
| Institution bundle | `services/export/institutionalExport.service.js` |
| Manifest validation | `scripts/verifyInstitutionExport.js` |
| Snapshot consistency | `scripts/verifySnapshots.js` |
| Audit integrity | `scripts/verifyAuditIntegrity.js` |

No cloud backup automation in-repo — use Atlas or scheduled `mongodump`.

---

## Migration readiness

Optional on major collections: `schemaVersion`, `migrationMeta.{ migratedFrom, importedBy, sourceSystem, importBatchId }`. Existing docs without these fields remain valid.

Use `utils/ids.js` (`normalizeId`, `idsEqual`) for new code.

**Flow:** export → `verifyInstitutionExport` → `verify:snapshots` / `verify:audit-integrity`.

**Out of scope:** PostgreSQL, Kubernetes, live multi-cloud failover, S3 (adapter hook only).

---

## Portability strategy

Prepare for future migration (AWS, Azure, self-hosted Docker) **without** changing current stack (Atlas, existing Redis, current hosting).

**Future paths:**

- **AWS:** S3 adapter + `STORAGE_PROVIDER=s3`
- **Self-host:** `STORAGE_PROVIDER=local`, `docker-compose.prod.yml`
- **Queue swap:** new adapter behind `services/jobs/`

---

## Workflow consistency (U13–U16)

**Upload UX:** `FileAttachmentPanel` → `useFileUploadQueue` → `POST /api/upload` → domain APIs with `fileAssetIds`. Surfaces: assignments, pages, syllabus, announcements, discussions, inbox.

**Course ops:** copy (`courseCopy.service.js`); archive/restore (`operationalStatus`); bulk (`POST /api/courses/bulk`).

**Maintenance:** `courseMaintenance.service.js` + `workers/fileMaintenanceWorker.js`.

Details: [files-and-uploads.md](./files-and-uploads.md).
