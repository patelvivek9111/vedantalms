# Scaling guidelines

## Database

- Keep FileAsset queries scoped by `courseId` + pagination (50/page UI).
- Index integrity: `npm run verify:index-integrity` in CI.
- Gradebook: use existing `perf:gradebook` bench before term start.

## Workers

- Scale `worker:grading-jobs` with Redis; one worker per CPU for heavy finalize.
- File maintenance worker off-peak only.

## Load testing

- `npm run test:load` with `LOAD_BASE_URL`, `LOAD_AUTH_TOKEN`, `LOAD_COURSE_ID`.
- Target: p95 < 2s for gradebook on 1k-enrollment course (staging).

## Frontend

- Large attachment lists paginate at 50 items; avoid hydrating full thread trees without pagination.
