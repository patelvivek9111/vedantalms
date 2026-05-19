# Deployment

## Required processes

| Process | Command | Notes |
|---------|---------|--------|
| API server | `npm start` or `npm run dev` | Express + Socket.IO |
| Grading worker | `npm run worker:grading-jobs` | Required when `REQUIRE_JOB_QUEUE=true` |
| Frontend | Static build from `npm run build` | Served by API or CDN |

## Environment variables

### Core

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Strong secret; never use defaults in production |
| `FRONTEND_URL` | Yes | CORS / redirects |
| `NODE_ENV` | Yes | `production` in prod |

### Grading & jobs

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | — | BullMQ + Socket.IO adapter |
| `REQUIRE_REDIS` | `false` | `/health/ready` fails if Redis adapter unavailable |
| `REQUIRE_JOB_QUEUE` | `false` | `/health/ready` fails if Redis missing for BullMQ |
| `GRADING_ASYNC_STUDENT_THRESHOLD` | `50` | Auto-async finalize/recompute above this enrollment |
| `JOB_DOWNLOAD_SECRET` | `JWT_SECRET` | HMAC for export download tokens |
| `DISABLE_JOB_QUEUE` | — | Force inline jobs (dev/test only) |

### Boot

| Variable | Description |
|----------|-------------|
| `SYNC_INDEXES_ON_BOOT` | Set `true` on first deploy or after model index changes |

## Release checklist

1. `npm ci` and `cd frontend && npm ci`
2. `npm run build`
3. `npm run verify:grading` and `npm run test:grading`
4. `npm run migrate:dry-run` against staging DB
5. Deploy API + worker + frontend
6. `npm run migrate` during maintenance window (if dry-run showed changes)
7. Verify `GET /health/ready` and spot-check gradebook lifecycle UI

See also [../production-checklist.md](../production-checklist.md).
