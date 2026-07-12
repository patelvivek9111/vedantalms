# Production guide

Deploy, secure, scale, and recover MySl8te in production.

---

## Quick commands

```bash
npm run build
npm run verify:grading && npm run test:grading
npm run validate:indexes
npm run migrate:dry-run    # preview DB migrations
npm run migrate            # apply migrations (maintenance window)
npm run worker:grading-jobs   # BullMQ worker (requires REDIS_URL)
```

**Health endpoints:** `GET /health`, `GET /health/ready` are public; `GET /health/ops`, `GET /health/dependencies`, and `GET /metrics` require `METRICS_TOKEN` or admin JWT in production.

---

## Processes

| Process | Command | Notes |
|---------|---------|--------|
| API server | `npm start` | Express + Socket.IO |
| Grading worker | `npm run worker:grading-jobs` | Required when `REQUIRE_JOB_QUEUE=true` |
| File maintenance | `npm run worker:file-maintenance` | Nightly orphan/integrity sweeps |
| Frontend | `npm run build` output | Vercel/CDN or served by API |

---

## Environment variables

### Core

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Strong secret; never use defaults in production |
| `FRONTEND_URL` | Yes | CORS, redirects, `secure` httpOnly auth cookies |
| `NODE_ENV` | Yes | `production` in prod |
| `VITE_API_URL` | Yes (frontend) | API base URL in Vercel |

### Grading & jobs

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | — | BullMQ + Socket.IO adapter |
| `REQUIRE_REDIS` | `false` | `/health/ready` fails if Redis adapter unavailable |
| `REQUIRE_JOB_QUEUE` | `false` | `/health/ready` fails if Redis missing for BullMQ |
| `GRADING_ASYNC_STUDENT_THRESHOLD` | `50` | Auto-async finalize/recompute above this enrollment |
| `JOB_DOWNLOAD_SECRET` | `JWT_SECRET` | HMAC for export download tokens |
| `DISABLE_JOB_QUEUE` | — | Force inline jobs (dev/test only) |
| `SYNC_INDEXES_ON_BOOT` | — | Set `true` on first deploy or after model index changes |

### Security hardening

| Variable | Description |
|----------|-------------|
| `METRICS_TOKEN` | Protects `/metrics` in production |
| `CLAMAV_ENABLED` | Virus scan uploads (`CLAMAV_HOST` / `CLAMAV_PORT`) |
| `MESSAGE_SANITIZER` | Set `dompurify` for inbox/message HTML |
| `STORAGE_PROVIDER` | `cloudinary` (or S3) — not local disk in production |
| `DISABLE_PUBLIC_REGISTRATION` | Optional; onboard users via admin only |

Path overrides: see [architecture.md](./architecture.md).

---

## Release checklist

Use before each production deployment.

### 1) Environment and config

- [ ] Backend env vars set in hosting provider (Render or equivalent)
- [ ] `VITE_API_URL` set in Vercel
- [ ] `JWT_SECRET` is strong (not a default)
- [ ] `MONGODB_URI` points to correct production database
- [ ] `FRONTEND_URL` matches deployed frontend domain
- [ ] `REDIS_URL` set if required for scale/queues
- [ ] Cloudinary (or cloud storage) credentials set for uploads

### 2) Predeploy validation

- [ ] `npm ci` and `cd frontend && npm ci`
- [ ] `npm run build`
- [ ] `npm run verify:grading` and `npm run test:grading`
- [ ] `npm run validate:indexes` (staging DB)
- [ ] `npm run migrate:dry-run` (staging DB)
- [ ] `npm run smoke:predeploy`
- [ ] `npm run audit:duplicates`
- [ ] No critical lint/TypeScript errors in changed files
- [ ] Worker and Redis requirements reviewed (see Scaling below)

### 3) Runtime health (after deploy)

- [ ] `GET /health` returns `ok`
- [ ] `GET /health/ready` returns `ready` (or expected degraded reason)
- [ ] `GET /health/ops` returns metrics payload (with `METRICS_TOKEN` or admin JWT in production)
- [ ] `GET /metrics` reachable for Prometheus (with auth)

### 4) Frontend sanity

Routes: `/dashboard`, `/courses`, `/assignments/:id/view`, `/calendar`, `/inbox`, `/todo`

Behavior: login/logout, notifications (no raw HTML), personal to-do, assignment view loads

### 5) Observability

- [ ] Prometheus target up; Grafana dashboard loads
- [ ] No critical alerts firing unexpectedly

### 6) Rollback readiness

- [ ] Previous stable version/tag identified
- [ ] Rollback process documented for current host
- [ ] Migration compatibility checked (`npm run migrate:dry-run`; see `MigrationRun` collection)
- [ ] Mongo backup taken before `npm run migrate` in production

---

## Security checklist

Use before go-live and after major deployments.

### Required

- [ ] `NODE_ENV=production` on API
- [ ] `JWT_SECRET` — long random secret; rotate if leaked
- [ ] `MONGODB_URI` — managed Mongo with auth, IP allowlist, backups
- [ ] `FRONTEND_URL=https://your-domain.com`
- [ ] HTTPS everywhere; no mixed HTTP auth
- [ ] Secrets only in env — never commit `.env` or keys

### Auth & access

- [ ] `DISABLE_PUBLIC_REGISTRATION=true` if onboarding via admin only
- [ ] Admin accounts created through trusted channels
- [ ] Password reset email (`SMTP_*`) configured
- [ ] Suspended users blocked (`accountStatus=suspended`)
- [ ] Session invalidation after password change (`tokenVersion`)

### Hardening (~2,500 users)

- [ ] `METRICS_TOKEN`, `CLAMAV_ENABLED`, `MESSAGE_SANITIZER=dompurify`
- [ ] Cloud storage for uploads (not local disk)
- [ ] `REDIS_URL` + `REQUIRE_REDIS=true` if multi-instance or queues required
- [ ] CORS `FRONTEND_URL` matches actual origin (no wildcard)
- [ ] Database and Redis not publicly reachable without credentials

### Privacy & data lifecycle

- [ ] User and course delete cascades tested
- [ ] Privacy policy and terms linked from signup (`/privacy`, `/terms`)
- [ ] Signup requires `termsAccepted` in production

### Post-deploy smoke

1. Login / logout / refresh — no redirect loop
2. Student cannot access teacher-only routes
3. Public registration cannot create `admin` or `teacher` in production
4. File upload/download respects enrollment
5. Password reset email works once

### Not a substitute for

Penetration testing, formal FERPA/GDPR review, WAF/DDoS at the edge, or regular secret rotation.

See [security.md](./security.md) for FERPA role matrix and audit events.

---

## Scaling

### Grading workload

| Operation | Sync path | Async path (BullMQ) |
|-----------|-----------|---------------------|
| Finalize course | ≤ threshold students | `grades.finalize` job |
| Recompute apply | ≤ threshold | `grades.recompute` job |
| Gradebook export | Inline if no Redis | `export.gradebook` job |
| Transcript regenerate | — | `transcript.regenerate` job |

Default async threshold: **50 students** (`GRADING_ASYNC_STUDENT_THRESHOLD`).

- **Redis:** Socket.IO adapter for horizontal API scaling; BullMQ queue `grading` via `worker:grading-jobs` (`GRADING_WORKER_CONCURRENCY`, default 2)
- **Gradebook API:** paginate (`pageSize` max 200); avoid loading all rows client-side
- **Indexes:** `npm run validate:indexes` after upgrades
- **Rate limits:** tune via `GRADING_LIFECYCLE_*`, `RECOMPUTE_RATE_*`, `TRANSCRIPT_RATE_*`; `DISABLE_RATE_LIMIT=true` only in dev

### Load & monitoring signals

- API p95 latency (gradebook, `/api/files`, transcript)
- BullMQ queue depth and failed job rate
- File orphan growth (`npm run verify:file-orphans`)
- Integrity reports under `uploads/reports/integrity/`
- Admin → System Settings → Operations dashboard

**Alerts:** failed jobs > 50/hour; unsafe file count > 0; Redis down > 5 min; health script non-zero.

**Load test:** `npm run test:load` with `LOAD_BASE_URL`, `LOAD_AUTH_TOKEN`, `LOAD_COURSE_ID` — target p95 < 2s gradebook on 1k-enrollment course (staging).

---

## Grading audit model

### Lifecycle

```text
DRAFT → POSTED → FINALIZED
                    ↓ (registrar amend)
              new snapshots (append-only)
```

| State | Student sees | Instructor edits | Policy edits affect term |
|-------|--------------|------------------|---------------------------|
| DRAFT | Provisional | Yes | Yes |
| POSTED | Yes | Yes (audited) | Yes |
| FINALIZED | Locked | No | No (use amend) |

**Immutable artifacts:** `StudentCourseGradeSnapshot` (one current row per student/course/term/year); `CourseGradeLifecycle` per course/term/year.

**Audit streams:** `SystemAuditEvent`, `GradingPolicyAudit`, `GradeAmendmentRecord`, `AsyncJob`; unified UI via `GET .../audit-timeline` and `GET .../provenance`.

**Engine:** `calculateCourseGradeForStudent` → `calculateFinalGradeWithWeightedGroups`; version in `shared/grading/gradingEngineVersion.cjs`.

**Registrar capabilities:** `post_grades` (teacher own course, registrar, admin); `finalize_grades` / `amend_grades` / `recompute_grades` (registrar, department_admin, admin).

**Migrations:** logged in `MigrationRun`; run `npm run migrate:dry-run` before apply.

---

## Disaster recovery

### Data that must not be lost

| Store | Contents |
|-------|----------|
| MongoDB | Courses, submissions, grade snapshots, lifecycle, audit logs |
| Job exports | `uploads/job-exports/` (regenerable if lost) |

Transcript integrity depends on **frozen snapshots** + **FINALIZED** lifecycle.

### Backup strategy

1. Continuous MongoDB backups (Atlas or scheduled `mongodump`)
2. Document RPO/RTO with institution
3. Store backup credentials separately from app secrets
4. Institution portable bundles: `npm run export:institution` — see [operations.md](./operations.md)

### Rollback application

1. Deploy previous API/worker/frontend artifact
2. Do **not** re-run destructive migrations without review
3. If bad migration ran, restore Mongo from pre-migrate backup

### Rollback grades

- Never delete `StudentCourseGradeSnapshot` for compliance; amendments supersede via `isCurrent: false`
- Correct finalized terms: registrar **amend** or controlled **recompute** with `forceAmend` + reason

### Verify after incident

```bash
npm run validate:indexes
npm run migrate:dry-run
npm run verify:snapshots
npm run verify:audit-integrity
```

### Rollback runbook (deploy)

1. Stop grading and file maintenance workers
2. Revert application image/tag
3. `npm run verify:production-health` on rolled-back build
4. If schema migration ran, restore Mongo from pre-deploy snapshot (no idempotent down script)
5. Invalidate download tokens; reconcile stuck async jobs via admin recovery
6. Notify registrars if transcript issuance overlapped rollback window

---

## Deployment validation (extended)

**Pre-deploy:** `verify:production-health`, `verify:index-integrity`, `test:institutional-workflows`, Redis/Mongo backups within RPO.

**Post-deploy:** login (all roles), secure file upload/preview, discussion attachment, archived course blocks upload, course copy job, ops dashboard, grade finalize + transcript.

**Data safety:** no duplicate lifecycle rows after copy; transcript snapshots append-only; audit events for archive/copy/attachment remove.

---

## Institutional onboarding

1. Import users/courses via portability bundle (staging first) — see [architecture.md](./architecture.md)
2. Configure grading policy snapshots per term before finalize window
3. Train instructors on shared file attachment flows
4. Enable registrar amendment workflow; verify audit timeline
5. Run large course copy in async mode; confirm no grades/transcripts copied
6. Archive prior-term courses; confirm read-only messaging
