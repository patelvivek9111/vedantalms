# Institution Backup Runbook

## Purpose

Create a portable, integrity-verified institution bundle for DR, audit, or future provider migration.

## Prerequisites

- MongoDB reachable (`MONGODB_URI`)
- Disk space for `INSTITUTION_EXPORTS_DIR` (default `uploads/exports/institution`)
- Maintenance window recommended for very large institutions

## Full backup

```bash
npm run export:institution
```

Partial domain backup:

```bash
node scripts/exportInstitutionBundle.js --sections=users,courses,gradeSnapshots,transcriptSnapshots,policyAudits
```

Resume interrupted export:

```bash
node scripts/exportInstitutionBundle.js --batch-id=export-<timestamp>
```

## Verification

```bash
npm run verify:institution-export -- uploads/exports/institution/<batchId>
npm run verify:backup-compatibility -- uploads/exports/institution/<batchId>
npm run verify:data-integrity
```

## Acceptance checklist

- [ ] `manifest.json` present with `exportVersion` `2.0.0`
- [ ] All required sections present for your compliance scope
- [ ] `checksum` validates via `verify:institution-export`
- [ ] Per-section `contentHash` matches files
- [ ] No password or token fields in `users.json`
- [ ] `InstitutionBackupManifest` row created (when DB available)
- [ ] Archive copied to secondary storage off-app-server

## Notes

- Frozen grade snapshots and transcript issuance logs are append-only in export.
- Large institutions: exports chunk automatically (500 records per file by default).
