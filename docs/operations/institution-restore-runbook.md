# Institution Restore Runbook

## Purpose

Safely import a portable institution bundle into a target environment without overwriting finalized academic records.

## Prerequisites

- Verified backup bundle (`npm run verify:institution-export`)
- Target `MONGODB_URI` (prefer isolated staging first)
- Compatibility check passed (`npm run verify:backup-compatibility`)

## Procedure

### 1. Validate only (no writes)

```bash
node scripts/restoreInstitutionBundle.js uploads/exports/institution/<batchId> --validate-only
```

### 2. Dry run

```bash
node scripts/restoreInstitutionBundle.js uploads/exports/institution/<batchId> --dry-run --skip-existing
```

### 3. Restore with ID remapping (new environment)

```bash
node scripts/restoreInstitutionBundle.js uploads/exports/institution/<batchId> --remap-ids --skip-existing
```

### 4. Merge non-conflicting updates

```bash
node scripts/restoreInstitutionBundle.js uploads/exports/institution/<batchId> --merge --sections=courses,modules
```

## Modes

| Flag | Behavior |
|------|----------|
| `--validate-only` | Manifest + hash + compatibility only |
| `--dry-run` | Simulate counts, no writes |
| `--skip-existing` | Skip documents that already exist (default) |
| `--merge` | Update existing non-finalized records |
| `--remap-ids` | Generate new ObjectIds, preserve mapping report |

## Rollback

Imports use staged transactions where supported. If restore fails mid-run:

1. Abort — transaction rolls back active stage.
2. Do **not** re-run with `--merge` on finalized grade sections.
3. Restore MongoDB from pre-restore snapshot if partial writes occurred outside transaction.

## Post-restore verification

```bash
npm run verify:data-integrity
npm run verify:snapshots
npm run verify:audit-integrity
npm run verify:restore
```

## Restore acceptance checklist

- [ ] Integrity report `ok: true`
- [ ] No unexpected `frozen_snapshot_exists` conflicts on second run
- [ ] Transcript issuance rows unchanged when skipped
- [ ] Sample student transcript matches pre-restore letter grades
- [ ] Policy audit chain intact (`verify:audit-integrity`)
