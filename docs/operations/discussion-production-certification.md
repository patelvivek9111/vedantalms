# Discussion Production Certification

This document is the rollout gate for institutional discussion completion. It covers Phase D through Phase G validation only; it does not redesign discussion architecture.

## Certification Commands

Run these before enabling collection-only replies or pruning embedded replies:

```powershell
npm run bench:discussion-large -- --apply
npm run verify:discussion-integrity
npm run verify:group-discussion-integrity
npm run verify:discussion-migration-closure
npm run repair:discussion-counters:dry-run
npm run repair:discussion-participation:dry-run
npm run verify:discussion-participation
npx jest tests/discussions --runInBand
```

Run browser certification against the seeded environment:

```powershell
npm run test:e2e -- e2e/specs/discussion-hardening.spec.ts
```

## Production Readiness Thresholds

Default benchmark thresholds are encoded in `scripts/bench/discussionLargeCourseBench.js` and can be overridden with environment variables.

| Metric | Default Threshold |
| --- | --- |
| Root reply page p95 | <= 250 ms |
| Child reply page p95 | <= 250 ms |
| Mark-read p95 | <= 250 ms |
| Hide/restore p95 | <= 500 ms |
| Root reply payload | <= 256 KB |
| Heap delta during sampled benchmark | <= 100 MB |

Required qualitative checks:

- Thread detail responses do not hydrate full reply trees.
- Child expansion remains bounded by pagination limit.
- Hidden discussion grades do not appear in student totals.
- Hidden replies return tombstone/hidden semantics to students.
- Participation counts survive edit/delete/restore.
- Group-scoped discussions require both `groupSet` and `groupId`.

## Benchmark Snapshot Rules

Run live certification with `node scripts/verify-discussion-production-readiness.js --run-benchmark`, or save benchmark JSON in release evidence storage (not committed to git).

Snapshot must include:

- `targets.studentCount`
- `targets.replyCount`
- `targets.sampleRuns`
- `timings.*.p50`
- `timings.*.p95`
- `payloadBytes`
- `memory`
- `validations`
- `pass`

## Migration Closure Gate

Do not run `migrate-discussion-replies-to-collection.js --apply --prune-embedded` until all of these are true:

- `verify:discussion-integrity` exits cleanly.
- `verify:discussion-migration-closure` reports `safeToPruneEmbeddedReplies: true`.
- Large-course benchmark passes thresholds.
- Discussion E2E and accessibility pass in browser.
- A database rollback snapshot exists.
- Support runbooks are reviewed.

## Failure Recovery

- Counter mismatch: run `npm run repair:discussion-counters:dry-run`, inspect output, then run `npm run repair:discussion-counters`.
- Participation drift: run `npm run repair:discussion-participation:dry-run`, inspect sample rows, then run `npm run repair:discussion-participation`.
- Negative unread/read-state drift: run `npm run verify:discussion-participation`, then `npm run repair:discussion-read-state`.
- Hidden reply visibility concern: run `npm run support:discussion-dashboard` and inspect moderation counts, then review `GET /api/threads/:threadId/moderation-log`.
- Migration mismatch: stop pruning, preserve embedded replies, rerun migration dry-run, and compare `legacyReplyId` coverage with `verify:discussion-migration-closure`.
