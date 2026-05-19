# Production Release Checklist

Use this checklist before each production deployment.

## 1) Environment and Config

- [ ] Backend env vars are set in hosting provider (Render or equivalent).
- [ ] Frontend env var `VITE_API_URL` is set in Vercel for the target environment.
- [ ] `JWT_SECRET` is strong and not a default value.
- [ ] `MONGODB_URI` points to the correct production database.
- [ ] `FRONTEND_URL` matches the deployed frontend domain.
- [ ] If required for scale, `REDIS_URL` is set and reachable.
- [ ] If required for uploads, Cloudinary credentials are set.

## 2) Predeploy Validation

- [ ] Run backend install: `npm ci`
- [ ] Run frontend install: `cd frontend && npm ci`
- [ ] Run build: `npm run build`
- [ ] Run `npm run verify:grading` and `npm run test:grading`
- [ ] Run `npm run validate:indexes` (against staging DB)
- [ ] Run `npm run migrate:dry-run` (against staging DB)
- [ ] Run smoke check: `npm run smoke:predeploy`
- [ ] Run duplicate audit: `npm run audit:duplicates`
- [ ] Confirm no critical lints/typescript errors in changed files.
- [ ] Review [docs/production/README.md](./production/README.md) for worker and Redis requirements

## 3) Runtime Health Checks

After deploy, verify:

- [ ] `GET /health` returns `ok`
- [ ] `GET /health/ready` returns `ready` (or expected degraded reason)
- [ ] `GET /health/ops` returns metrics payload
- [ ] `GET /metrics` is reachable for Prometheus

## 4) Frontend Sanity Checks

Quick route verification:

- [ ] `/dashboard`
- [ ] `/courses`
- [ ] `/assignments/:id/view`
- [ ] `/calendar`
- [ ] `/inbox`
- [ ] `/todo`

Quick behavior verification:

- [ ] Login/logout works
- [ ] Notifications render clean text (no raw HTML tags)
- [ ] Personal to-do can be marked done
- [ ] Assignment view loads without missing chunk/import errors

## 5) Observability and Alerting

- [ ] Prometheus target is up
- [ ] Grafana dashboard loads and shows current data
- [ ] Alertmanager is reachable
- [ ] No critical alerts are firing unexpectedly

## 6) Rollback Readiness

- [ ] Previous stable version/tag is identified
- [ ] Rollback command/process is documented for current host
- [ ] Database migration compatibility checked (`npm run migrate:dry-run`; see `MigrationRun` collection)
- [ ] Team knows who executes rollback if needed
- [ ] Mongo backup taken before `npm run migrate` in production

## Notes

- Keep this checklist strict for production and relaxed for staging.
- Update this file whenever release steps or infrastructure change.
