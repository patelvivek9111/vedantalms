# Vedanta LMS — Phases G–M Production Hardening Report

**Status:** Delivered (post Waves A–F)  
**Constraint:** Canonical grading engine unchanged (`calculateFinalGradeWithWeightedGroups` via `shared/grading`).

---

## Architecture summary

```text
Clients → API (helmet, rate limits, correlation IDs, FERPA middleware)
       → lifecycle / policy / gradebook services
       → MongoDB (immutable snapshots, audit, staging)
       → Redis (policy cache, BullMQ jobs, distributed locks)
       → grading worker (retries, export tokens)
```

All grade percentages still flow through `calculateCourseGradeForStudent` → shared grading.

---

## Phase G — Security & FERPA

| Deliverable | Location |
|-------------|----------|
| Extended RBAC | `middleware/academicPermissions.js` |
| FERPA middleware | `middleware/ferpaAccess.js` |
| FERPA audit | `services/ferpaAudit.service.js` |
| Correlation IDs | `middleware/requestCorrelation.js` |
| Immutable snapshots/amendments/transcript logs | `models/plugins/immutableAppendOnly.plugin.js` |
| Audit integrity CLI | `scripts/verifyAuditIntegrity.js` → `npm run verify:audit-integrity` |
| Export download audit | `controllers/jobs.controller.js`, `grades.controller.js` |
| Registrar submission block | `controllers/submission.controller.js` |

**Tests:** `tests/grading/ferpaAccess.policy.test.js`

---

## Phase H — Reliability & DR

| Deliverable | Location |
|-------------|----------|
| Snapshot archive | `services/backup/snapshotArchive.service.js` |
| Snapshot verify CLI | `scripts/verifySnapshots.js` → `npm run verify:snapshots` |
| Distributed locks | `services/distributedLock.service.js` |
| Idempotent finalize | `services/gradeLifecycle.service.js` |
| Job retries + failure audit | `services/jobQueue.service.js` |

---

## Phase I — Scale & performance

| Deliverable | Location |
|-------------|----------|
| Redis policy cache | `services/policyRedisCache.service.js` |
| Gradebook pagination (existing) | `services/gradebookData.service.js` |
| Perf smoke | `scripts/perf/gradebookBench.js` |

**Note:** Full streamed XLSX + cursor pagination extension can be enabled per deployment via async export jobs (Wave D).

---

## Phase J — Interoperability

| Deliverable | Location |
|-------------|----------|
| SIS staging (no direct grade writes) | `models/sisStagingEnrollment.model.js`, `services/sis/index.js` |
| LTI 1.3 scaffold (no AGS) | `services/lti/ltiReadiness.service.js` |
| Registrar reports API | `/api/registrar/reports/*` |

---

## Phase K — Observability

| Deliverable | Location |
|-------------|----------|
| `/health/live`, `/health/dependencies` | `server.js`, `controllers/ops.controller.js` |
| Ops dashboard API | `GET /api/ops/dashboard` |
| Structured logging | pino-http + correlation IDs |

---

## Phase L — Accessibility

Targeted gradebook/policy compliance attributes (ARIA labels, table roles) in `GradebookView.tsx` / `GradingPolicyModal.tsx` — compliance pass without UI redesign.

---

## Phase M — Deployment maturity

| Deliverable | Location |
|-------------|----------|
| Startup env validation | `config/startupValidation.js` |
| Docker | `Dockerfile`, `docker-compose.prod.yml` |
| CI | `.github/workflows/hardening-production.yml` |
| Runbooks | `docs/operations/`, `docs/security/` |

---

## API additions

- `GET /health/live`
- `GET /health/dependencies`
- `GET /api/ops/dashboard`
- `GET /api/registrar/reports/term-completion`
- `GET /api/registrar/reports/amendments`
- `GET /api/registrar/reports/policy-changes`
- `GET /api/registrar/reports/finalized-courses` (`?format=csv`)

---

## Known limitations

- SIS adapters stage enrollments only; no Banner/PeopleSoft live connectors without integration project.
- LTI AGS grade sync not implemented.
- Department admin has no department boundary scoping.
- WCAG audit is baseline attribute pass, not full third-party certification.
- `verify:audit-integrity` / `verify:snapshots` require MongoDB at runtime.

---

## Verification commands

```bash
npm run verify:grading
npm run test:grading
npm run verify:audit-integrity   # needs MongoDB
npm run verify:snapshots         # needs MongoDB
npm run migrate:dry-run
cd frontend && npm run test:grading
```
