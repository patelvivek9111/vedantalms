# Production monitoring

## Signals

- API p95 latency (gradebook, `/api/files`, transcript)
- BullMQ queue depth (`pending` + `active` async jobs)
- Failed job rate (`status: failed`)
- File orphan candidate growth (`npm run verify:file-orphans`)
- Integrity reports under `uploads/reports/integrity/`

## Alerts

- `failed` async jobs > 50/hour
- Unsafe file count > 0 (investigate before auto-delete)
- Redis unavailable > 5 minutes (degraded uploads/jobs)
- Production health script exits non-zero

## Dashboards

- Admin → System Settings → Operations (ops dashboard, recovery, files)
