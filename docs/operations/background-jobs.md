# Background jobs

## Types

| Job | Purpose |
|-----|---------|
| `course.copy` | Large course duplication |
| `course.bulk` | Bulk publish/archive/due-date shift |
| `maintenance.files` | Orphan scan, stale temp marking, integrity summary |

## Cron

Run `npm run worker:file-maintenance` on a schedule (e.g. nightly).

## Visibility

Admin → Settings → Operations shows job queues and file metrics.
