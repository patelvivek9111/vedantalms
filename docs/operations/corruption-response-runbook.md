# Corruption Response Runbook

## Purpose

Respond to detected data integrity issues, hash mismatches, or audit chain breaks without amplifying damage.

## Detection

Automated:

```bash
npm run verify:data-integrity
npm run verify:snapshots
npm run verify:audit-integrity
npm run verify:institution-export -- <exportDir>
```

## Severity classification

| Signal | Severity | Action |
|--------|----------|--------|
| `export_hash_mismatch` | High | Do not restore bundle; obtain earlier archive |
| `snapshot_checksum_mismatch` | Critical | Freeze transcript issuance; escalate |
| `orphaned_submissions` | Medium | Repair references or restore section |
| `duplicate_enrollments` | Low | Dedupe course.students array |
| `missing_policy_snapshots` | High | Restore policy sections before recomputing |

## Response steps

1. **Contain** — enable maintenance mode; pause async grading jobs.
2. **Snapshot** — take MongoDB backup and institution export before repairs:
   ```bash
   npm run export:institution
   ```
3. **Diagnose** — save JSON report from `verify:data-integrity` (`uploads/reports/`).
4. **Repair path A (preferred)** — restore affected sections from last good bundle:
   ```bash
   node scripts/restoreInstitutionBundle.js <good-bundle> --sections=gradeSnapshots --skip-existing
   ```
5. **Repair path B** — manual Mongo fix only with registrar approval; never edit frozen snapshot grades in place.
6. **Verify**
   ```bash
   npm run verify:data-integrity
   npm run verify:audit-integrity
   ```

## Dry-run before any restore

```bash
node scripts/restoreInstitutionBundle.js <bundle> --dry-run --validate-only
```

## Escalation

- Checksum failures on frozen snapshots: treat as academic integrity incident.
- Document incident in `systemAudit` and registrar ticket.
- See also `docs/operations/incident-response.md` for grading-specific incidents.
