# Migration readiness

## Schema metadata (P2)

Optional on major collections:

- `schemaVersion` (default `1`)
- `migrationMeta.{ migratedFrom, importedBy, sourceSystem, importBatchId }`

Existing documents without these fields remain valid.

## ID normalization

Use `utils/ids.js` (`normalizeId`, `idsEqual`) instead of ad-hoc `ObjectId` comparisons in new code.

## Backup / restore flow

1. `exportInstitutionBundle()` → manifest + JSON sections
2. `verifyInstitutionExport.js` → checksum + file presence
3. `verify:snapshots` / `verify:audit-integrity` → grading record consistency

## Not in scope (this phase)

- PostgreSQL
- Kubernetes
- Live multi-cloud failover
- S3 integration
