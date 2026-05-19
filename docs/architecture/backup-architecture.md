# Backup architecture

## Layers

| Layer | Tool |
|-------|------|
| Grade snapshots | `services/backup/snapshotArchive.service.js` |
| Institution bundle | `services/export/institutionalExport.service.js` |
| Manifest validation | `scripts/verifyInstitutionExport.js` |
| Snapshot consistency | `scripts/verifySnapshots.js` |
| Audit integrity | `scripts/verifyAuditIntegrity.js` |

## Paths (env-overridable)

See `config/paths.js` — `gradeArchives`, `institutionExports`, `jobExports`.

No cloud backup automation in this phase.
