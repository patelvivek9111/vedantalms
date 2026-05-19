# Migration Cutover Runbook

## Purpose

Coordinate a low-risk cutover when moving Vedanta LMS to a new host, MongoDB cluster, or storage provider. **This is preparation documentation** — execute only after staging validation.

## Timeline (recommended)

| Phase | Action |
|-------|--------|
| T-7d | Full institution export + off-site copy |
| T-3d | Restore to staging with `--remap-ids` or production IDs per plan |
| T-1d | Freeze grading finalization window; communicate maintenance |
| T-0 | Quiesce writes; final incremental export (courses, gradeSnapshots, transcriptSnapshots) |
| T+0 | Restore target; run verification suite |
| T+1h | Smoke test login, gradebook, transcript |
| T+24h | Re-enable finalization; monitor integrity job |

## Cutover steps

1. **Baseline export**
   ```bash
   npm run export:institution
   ```
2. **Verify**
   ```bash
   npm run verify:institution-export -- <batchDir>
   npm run verify:data-integrity
   ```
3. **Application stop** on source (maintenance mode in system settings).
4. **Final delta export** (partial sections for changes since baseline).
5. **Target restore**
   ```bash
   node scripts/restoreInstitutionBundle.js <batchDir> --validate-only
   node scripts/restoreInstitutionBundle.js <batchDir> --skip-existing
   ```
6. **Reconfigure env** on target: `MONGODB_URI`, `UPLOADS_DIR`, `JWT_SECRET` (new secret — users re-authenticate).
7. **Copy upload binaries** separately using storage manifest (`uploadsMetadata` section lists references).
8. **Verification**
   ```bash
   npm run verify:restore
   npm run verify:snapshots
   ```

## Rollback to source

- Keep source DB snapshot until T+48h sign-off.
- If cutover fails before DNS switch: discard target DB, resume source.
- If failed after DNS switch: restore source from pre-cutover backup; revert DNS.

## Grading / transcript guarantees

- Finalized snapshots are never silently overwritten (`--skip-existing` default).
- Transcript issuance logs are append-only on import.
- Policy snapshots travel with frozen grade rows for reproducibility.
