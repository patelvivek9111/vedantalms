# Scaling

## Grading workload patterns

| Operation | Sync path | Async path (BullMQ) |
|-----------|-----------|---------------------|
| Finalize course | ≤ threshold students | `grades.finalize` job |
| Recompute apply | ≤ threshold | `grades.recompute` job |
| Gradebook export | Inline if no Redis | `export.gradebook` job |
| Transcript regenerate | — | `transcript.regenerate` job |

Default async threshold: **50 students** (`GRADING_ASYNC_STUDENT_THRESHOLD`).

## Policy resolution

`getResolvedPolicyForCourse` memoizes per request via `policyCache` Map during batch finalize, gradebook build, and amend flows. Avoid creating new cache per student in loops.

## Gradebook API

`GET /api/grades/course/:courseId/gradebook?page=&pageSize=` returns paginated students (max 200 per page) with batched submission queries. Prefer pagination for courses with large enrollments instead of loading all rows client-side.

## Redis

- **Socket.IO adapter**: horizontal API scaling for real-time features
- **BullMQ**: grading queue `grading` — run `worker:grading-jobs` with concurrency `GRADING_WORKER_CONCURRENCY` (default 2)

## MongoDB indexes

Run after upgrades:

```bash
npm run validate:indexes
npm run migrate --only=003
```

Or enable `SYNC_INDEXES_ON_BOOT=true` on a single instance during deploy.

## Rate limits

Lifecycle, recompute, and transcript endpoints use express-rate-limit. Tune via `GRADING_LIFECYCLE_*`, `RECOMPUTE_RATE_*`, `TRANSCRIPT_RATE_*` env vars. Set `DISABLE_RATE_LIMIT=true` only in development.
