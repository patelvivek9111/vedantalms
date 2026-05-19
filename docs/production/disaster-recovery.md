# Disaster Recovery

## Data that must not be lost

| Store | Contents |
|-------|----------|
| MongoDB | Courses, submissions, `StudentCourseGradeSnapshot`, `CourseGradeLifecycle`, audit logs |
| Job exports | `uploads/job-exports/` (regenerated if lost) |

Transcript integrity depends on **frozen snapshots** + **lifecycle FINALIZED** state. Backups should include the full MongoDB dataset.

## Backup strategy

1. Enable **continuous MongoDB backups** (Atlas, or `mongodump` on a schedule).
2. Document **RPO/RTO** with your institution (typical: RPO 24h for LMS, stricter for registrar if required).
3. Store backup credentials separately from application secrets.

## Rollback application

1. Deploy previous API/worker/frontend artifact (tag or container image).
2. **Do not** re-run destructive migrations on production without review.
3. If a bad migration ran, restore Mongo from backup taken before migrate; migrations are logged in `MigrationRun`.

## Rollback grades / policy

- **Never** delete `StudentCourseGradeSnapshot` rows for compliance; amendments **supersede** via `isCurrent: false`.
- To correct finalized terms: registrar **amend** flow (`POST .../amend`) or controlled **recompute** with `forceAmend` + reason.
- Institution policy changes do **not** alter frozen transcript rows.

## Verify integrity after incident

```bash
npm run validate:indexes
npm run migrate:dry-run
```

Compare sample student transcripts before/after restore. Check `GET /api/grades/course/:id/provenance` for policy hash alignment.

## Transcript issuance

Official issuance logs live in `TranscriptIssueLog` with `transcriptHash`. Re-issuance creates a new log row; prior hashes remain auditable.
