# Institutional export architecture

## Service

`services/export/institutionalExport.service.js`

## Section registry

`shared/portability/sectionRegistry.cjs` — canonical order and exporters for all major LMS domains.

## Sections (JSON)

`systemSettings`, `users`, `courses`, `enrollments`, `modules`, `pages`, `assignments`, `submissions`, `quizzes`, `discussions`, `announcements`, `polls`, `groups`, `groupSets`, `meetings`, `attendance`, `institutionPolicies`, `coursePolicies`, `gradeSnapshots`, `transcriptSnapshots`, `lifecycleRecords`, `amendments`, `policyAudits`, `systemAudit`, `asyncJobs`, `notifications`, `notificationPreferences`, `calendarEvents`, `uploadsMetadata`, `permissionsRoles`

## Manifest (v2)

`shared/portability/exportManifest.cjs` — version `2.0.0`, top-level `schemaVersion`, per-section `contentHash`, `restoreCompatibilityVersion`, SHA-256 manifest checksum.

## Chunking & resume

- Large sections export in chunks of 500 records.
- `checkpoint.json` tracks completed sections for resumable exports.
- Partial export: `--sections=name1,name2`

## CLI

```bash
npm run export:institution
node scripts/exportInstitutionBundle.js --sections=users,courses
```

## Verification

```bash
npm run verify:institution-export -- uploads/exports/institution/<batchId>
npm run verify:backup-compatibility -- uploads/exports/institution/<batchId>
```

## Import

See `services/import/institutionalImport.service.js` and `docs/operations/institution-restore-runbook.md`.
