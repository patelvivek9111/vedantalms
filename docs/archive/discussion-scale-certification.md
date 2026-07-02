# Discussion Scale Certification

Phase D certifies the existing discussion architecture for institutional load. It does not introduce product features or redesign the Thread-centric workflow.

## Methodology

Use `scripts/bench/discussionLargeCourseBench.js` with `--apply` in a staging database. The benchmark creates temporary synthetic discussions, replies, participation rows, and moderation activity, then removes them unless `--keep` is supplied.

Default scenarios:

- `1k_students_50k_replies`
- `5k_students_50k_replies`

Each scenario validates:

- Root reply pagination.
- Child reply lazy loading.
- Concurrent root pagination.
- Concurrent reply posting with idempotency behavior.
- Concurrent mark-read operations.
- Concurrent hide/restore moderation actions.
- Counter and participation consistency.
- Payload and memory bounds.

## Certification Thresholds

Defaults are encoded in `discussionLargeCourseBench.js` and may be overridden by environment variables.

| Metric | Default |
| --- | --- |
| Root page p95 | `<= 300ms` |
| Child page p95 | `<= 300ms` |
| Concurrent pagination p95 | `<= 2000ms` |
| Concurrent reply posting p95 | `<= 8500ms` |
| Concurrent mark-read p95 | `<= 2500ms` |
| Concurrent moderation p95 | `<= 4500ms` |
| Root payload | `<= 256KB` |
| Heap delta | `<= 768MB` |
| CPU user time | `<= 120s` per scenario |

## Production Sizing Guidance

- Keep root reply page size at `50` by default.
- Do not exceed server-side page limit `100`.
- Prefer cursor pagination for large offsets.
- Use child reply lazy loading for nested trees.
- Keep reply HTML below `50KB` per reply.
- Treat 50k reply threads as large-thread mode and avoid any full-tree hydration.

## Mongo Sizing Guidance

Discussion collections must have enough working-set memory for:

- `discussionreplies` indexes on thread, parent, created time, author, deleted state, and idempotency.
- `discussionparticipations` indexes on thread/user and unread/read-state lookups.
- `discussionauditevents` indexes on thread/action/time.
- `threads` indexes for course, module, group-scoped, and moderation list queries.

Run:

```powershell
npm run verify:discussion-indexes
```

before rollout and after index migrations.

## Operational Limits

- Embedded replies are legacy fallback only.
- Collection-backed replies are canonical after migration closure passes.
- Hidden replies must serialize as hidden/tombstone state to students.
- Hidden grades must not enter student totals.
- Group discussions must include both `groupSet` and `groupId` unless manually approved as legacy data awaiting mapping.

## Recovery Expectations

- Counter drift: `npm run repair:discussion-counters`.
- Participation drift: `npm run repair:discussion-participation`.
- Read-state drift: `npm run repair:discussion-read-state`.
- Group partition drift: `npm run repair:group-discussion-partitions`, followed by manual mapping for ambiguous cases.
- Migration closure: `npm run verify:discussion-migration-closure`.

## Failure Scenarios

- Benchmark fails payload threshold: inspect accidental full reply hydration.
- Benchmark fails mark-read threshold: inspect `discussionparticipations` indexes and write contention.
- Benchmark fails moderation threshold: inspect audit writes and reply moderation indexes.
- Index verifier reports `COLLSCAN`: add matching compound index and rerun.
- Production readiness reports group warnings: map ambiguous legacy threads before claiming full institutional data certification.
