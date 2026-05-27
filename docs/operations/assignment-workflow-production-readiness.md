# Assignment Workflow Production Readiness Runbook

## Deployment Order

1. Deploy additive schema changes for `Assignment`, `Submission`, `Course.groups`, `SubmissionVersion`, and `MigrationMetadata`.
2. Deploy backend services with dual-read/dual-write support enabled.
3. Run `npm run migrate:assignment-group-ids:dry-run` and review row counts and mismatch reports.
4. Run `npm run verify:assignment-group-migration`.
5. Run `npm run migrate:assignment-group-ids` during a low-traffic window.
6. Deploy timed quiz sweep worker with `npm run worker:timed-quiz-sweep`.
7. Deploy frontend after backend routes are live.
8. Run the final verification suite and gradebook benchmark against a seeded institutional course.

## Rollback Safety

- Assignment group migration is additive and rollback-capable through `npm run rollback:assignment-workflow:dry-run`.
- Rollback removes only workflow metadata fields. It does not delete submissions, grades, files, transcripts, or FileAsset records.
- If a migration is interrupted, rerun the dry-run first. The migration is idempotent and records metadata in `MigrationMetadata`.
- Do not roll back after transcript finalization without registrar approval, because visible grade state may already have been communicated to students.

## Failure Recovery

Timed quiz worker outage:
- Restart the worker.
- Run `npm run recover:timed-quizzes:dry-run`.
- If candidates match expired attempts, run `npm run recover:timed-quizzes`.

Grade release mistake:
- To re-hide an accidental release, run `node scripts/ops/recoverGradeRelease.js --assignment <id> --hide --apply`.
- To release grades after a mistaken hide, run `node scripts/ops/recoverGradeRelease.js --assignment <id> --release --apply`.
- Student grade caches are invalidated on grading/release updates.

Migration interruption:
- Run the migration dry-run and verifier.
- Resume with the same migration command. It is safe to repeat.
- Review `MigrationMetadata` for duration, checksum, and row counts.

Gradebook overload:
- Keep pagination enabled.
- Reduce `pageSize` temporarily.
- Use `npm run bench:gradebook` to collect first-page latency and payload size.
- Avoid enabling full-dataset client loading.

## Safe Telemetry

Logs and metrics may include IDs, roles, route/action names, durations, statuses, and counts.
Do not log answers, feedback text, filenames, uploaded content, or student educational records.

## Certification Gates

- Access: unpublished and unavailable assignments return controlled denials.
- Timed quizzes: server deadlines survive refresh/reconnect, and terminal transitions are atomic.
- Grade release: hidden grades do not enter student payloads or totals.
- Submission history: resubmits create one version, and first timed quiz submits do not create false history.
- Scale: gradebook first-page benchmark stays under the institutional target.
- Migration: group IDs verify cleanly after copy/rename/migration.
