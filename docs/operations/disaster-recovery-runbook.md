# Disaster Recovery Runbook (Institution Portability)

## Scope

Recover Vedanta LMS after data loss, corruption, or total environment loss using institution portable bundles. Complements `docs/production/disaster-recovery.md` (Mongo-native backups).

## Recovery tiers

| Tier | Scenario | Approach |
|------|----------|----------|
| RTO-short | Single collection corruption | Partial export section restore |
| RTO-medium | DB lost, files intact | Full restore + upload sync |
| RTO-long | Total loss | Full export from off-site archive + Mongo provision |

## Recovery procedure

1. Provision new MongoDB and application host.
2. Set environment variables per `docs/architecture/environment-portability.md`.
3. Restore latest verified bundle:
   ```bash
   npm run verify:institution-export -- /path/to/archive/<batchId>
   node scripts/restoreInstitutionBundle.js /path/to/archive/<batchId> --validate-only
   node scripts/restoreInstitutionBundle.js /path/to/archive/<batchId> --skip-existing
   ```
4. Restore upload files to `UPLOADS_DIR` using `uploadsMetadata` section as index.
5. Run verification:
   ```bash
   npm run verify:data-integrity
   npm run verify:snapshots
   npm run verify:audit-integrity
   ```
6. Re-create secrets (JWT, SMTP, integration tokens) — not included in exports.

## Transcript integrity verification

```bash
npm run verify:snapshots
npm run verify:audit-integrity
```

Confirm:

- Each `FINALIZED` lifecycle has matching `isCurrent` frozen snapshots.
- `gradingPolicyHash` present on frozen rows.
- `recordChecksum` matches payload.

## Grading snapshot validation

- Spot-check 5 students: letter grade + policy version match pre-incident transcript PDFs.
- Compare `transcriptSnapshots` export section count to registrar issuance log.

## Acceptance

- [ ] Application starts with `validateStartupEnv` passing
- [ ] `verify:data-integrity` returns `ok: true`
- [ ] Registrar confirms sample transcripts unchanged
- [ ] Audit chain spot-check passes
