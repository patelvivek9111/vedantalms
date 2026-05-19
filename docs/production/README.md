# Vedanta LMS — Production Operations

Operational guides for deploying and running the institutional grading and academic records stack (Waves A–F).

| Document | Purpose |
|----------|---------|
| [**institutional-grading-readiness-report.md**](./institutional-grading-readiness-report.md) | **Waves A–F completion report** (executive summary, APIs, tests) |
| [deployment.md](./deployment.md) | Environment variables, processes, release steps |
| [scaling.md](./scaling.md) | Redis, workers, async thresholds |
| [disaster-recovery.md](./disaster-recovery.md) | Backups, rollback, transcript integrity |
| [grading-audit-model.md](./grading-audit-model.md) | Lifecycle, snapshots, audit events |

## Quick commands

```bash
npm run build
npm run verify:grading
npm run test:grading
npm run validate:indexes
npm run migrate:dry-run    # preview DB migrations
npm run migrate            # apply migrations (maintenance window)
npm run worker:grading-jobs   # BullMQ worker (requires REDIS_URL)
```

## Health endpoints

- `GET /health` — liveness
- `GET /health/ready` — Mongo, Redis adapter, job queue, object storage
- `GET /health/ops` — request metrics JSON
- `GET /metrics` — Prometheus text
