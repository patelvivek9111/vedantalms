# Upload Platform Production Runbook (U50F)

## Daily verification

```bash
npm run verify:upload-platform:final
npm run worker:blob-purge
```

Reports: `uploads/reports/upload-platform-final-report.{json,txt}`

## Scheduled jobs

| Job | Command | Purpose |
|-----|---------|---------|
| Blob purge | `npm run worker:blob-purge:apply` | Purge expired quarantine blobs |
| ZIP cleanup | Included in blob purge worker | Remove expired course ZIP exports |
| File maintenance | `npm run worker:file-maintenance` | Orphans, integrity sweeps |

## Recovery operations

1. **Admin → Settings → Operations → Recovery Center**
2. Use **Preview restore** for dry-run before applying restore
3. Search quarantined/deleted files by filename
4. Legal hold blocks purge — toggle via governance API or ops tools

## Retention settings

**Admin → Settings → Storage**

- Deleted blob retention (days)
- Deleted file metadata retention (days)
- ZIP export retention (hours)

## Incident response

| Symptom | Action |
|---------|--------|
| `PENDING_QUARANTINE` assets | Investigate quarantine failure; manual blob copy to quarantine dir |
| Preview corrupted | `POST /api/files/:id/preview/regenerate` |
| ZIP job stuck | Check async job queue; re-queue via course storage panel |
| Upload failures after outage | Users re-select files; session snapshot shows interrupted list |

## Pre-release gate

```bash
npm run test:files:all
npm run test:e2e
npm run verify:upload-platform:final
npm run verify:file-platform:institutional
```
