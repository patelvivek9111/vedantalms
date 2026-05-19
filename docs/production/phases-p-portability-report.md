# Phases P1–P6 — Platform Portability Report

**Status:** Preparation complete  
**Stack unchanged:** MongoDB Atlas, Redis, BullMQ, Cloudinary/local uploads

---

## 1. Architecture summary

Portable **facades** wrap storage, cache, and jobs. Business logic (grading, transcripts, lifecycle) is untouched. Institutional exports produce versioned manifests for future import/restore tooling.

---

## 2. New abstractions

| Phase | Addition |
|-------|----------|
| P1 | `services/storage/`, `services/cache/`, `services/jobs/` + adapters |
| P2 | `portabilityMetadata` plugin, `utils/ids.js`, `config/paths.js` |
| P3 | `institutionalExport.service.js`, export manifest, `verifyInstitutionExport.js` |
| P4 | `domains/{grading,transcript,audit}/` indexes |
| P5 | `config/providers.js`, expanded `startupValidation.js` |
| P6 | `docs/architecture/*` |

---

## 3. Schema metadata

Applied (additive) to: Course, Submission, Assignment, StudentCourseGradeSnapshot, TranscriptIssueLog, GradingPolicyAudit, Attendance, Announcement, Poll, GroupMeeting.

---

## 4. Files created (representative)

```
config/paths.js
config/providers.js
adapters/storage/{localStorageAdapter,cloudStorageAdapter}.js
adapters/cache/{redisCacheAdapter,memoryCacheAdapter}.js
adapters/jobs/bullMQAdapter.js
services/storage/index.js
services/cache/index.js
services/jobs/index.js
services/export/institutionalExport.service.js
shared/portability/{schemaMetadata,exportManifest}.cjs
models/plugins/portabilityMetadata.plugin.js
scripts/verifyInstitutionExport.js
tests/portability/*.policy.test.js
docs/architecture/*.md
```

---

## 5. Refactors (behavior-preserving)

- `policyRedisCache.service.js` → uses cache facade
- `distributedLock.service.js` → uses cache facade
- `gradingJobProcessors.js` / `snapshotArchive.service.js` → `config/paths`

---

## 6. Verification

```bash
npm run verify:grading
npm run test:grading
npm run test:portability
npm run verify:institution-export -- <dir>   # after export
```

---

## 7. Known limitations

- No S3/Azure/GCS adapters yet (interfaces ready)
- Institutional export is script/API-oriented, no admin UI
- MongoDB remains the system of record
- Full domain folder moves not performed (index files only)

---

## 8. Future migration recommendations

1. Implement `S3StorageAdapter` behind `getStorageService()` — no controller changes
2. Run institution export before cutover; validate manifest
3. Keep grading on shared engine through any host migration
4. Add `schemaVersion` increment only when document shape changes
