# Vedanta LMS — Institutional Grading Production Readiness Report

**Status:** Complete (Waves A–F)  
**Date:** May 2026  
**Scope:** Institutional hardening for grading, transcripts, registrar workflows, auditability, and production operations — **without** rewriting the canonical grading engine.

---

## Executive summary

Vedanta LMS grading was extended from a policy-aware calculator with snapshot support into a **production-grade academic records architecture** suitable for colleges and universities. The work was delivered in six waves over Phases 1–15 of the institutional readiness plan.

| Metric | Value |
|--------|-------|
| Canonical calculator | **Unchanged** — `calculateFinalGradeWithWeightedGroups` in `shared/grading` |
| Backend grading tests | **107** passing (`npm run test:grading`) |
| New API surfaces | Lifecycle, amend, recompute, jobs, provenance, audit timeline, paginated gradebook |
| New roles | `registrar`, `department_admin`, `teaching_assistant` |
| Migrations | 3 idempotent migrations with dry-run CLI |
| Production docs | `docs/production/` (5 guides + this report) |

**Core guarantee:** Historical transcript grades remain reproducible from frozen policy snapshots. Finalized terms are not silently recalculated when institution or course policy changes.

---

## Architecture (end state)

```text
                    ┌─────────────────────────────────────┐
                    │           Clients (React)            │
                    │  Gradebook · Policy modal · Lifecycle │
                    └─────────────────┬───────────────────┘
                                      │ REST
                    ┌─────────────────▼───────────────────┐
                    │         API + RBAC middleware        │
                    │  lifecycle · recompute · jobs · audit  │
                    └─────────────────┬───────────────────┘
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
   ┌──────▼──────┐            ┌───────▼───────┐           ┌───────▼───────┐
   │  MongoDB    │            │ shared/grading │           │ Redis/BullMQ  │
   │  snapshots  │            │ calculator +   │           │ async jobs    │
   │  lifecycle  │            │ policySnapshot │           │ (Wave D)      │
   │  audit logs │            │ engine version │           └───────────────┘
   └─────────────┘            └───────────────┘
```

**Single calculation path:** All percentage and letter results flow through `calculateCourseGradeForStudent` → shared grading. Lifecycle and policy gates sit in services/controllers only.

---

## Wave-by-wave delivery

### Wave A — Foundation (Phases 1–3)

**Goal:** Grade lifecycle + engine provenance without async or new roles.

| Deliverable | Details |
|-------------|---------|
| `CourseGradeLifecycle` model | `DRAFT` → `POSTED` → `FINALIZED` per `(course, term, year)` |
| Engine version | `shared/grading/gradingEngineVersion.cjs` — `1.0.0` |
| APIs | `GET/POST .../lifecycle`, `POST .../post`, `POST .../finalize` |
| Guards | Finalized blocks submission grading and course policy upsert; transcript uses frozen snapshots |
| Tests | `gradeLifecycle.e2e.test.js`, `gradeLifecycle.policy.test.js`, `gradingEngineVersion.policy.test.js` |

---

### Wave B — Registrar & security (Phase 4, 13 partial)

**Goal:** Capability-based RBAC, amend flow, audit logging.

| Deliverable | Details |
|-------------|---------|
| Roles | `registrar`, `department_admin`, `teaching_assistant` |
| `academicPermissions.js` | Capabilities: draft, post, finalize, amend, recompute, view lifecycle, manage institution policy |
| Amend flow | `POST .../amend` — supersedes snapshots (append-only), `GradeAmendmentRecord`, `SystemAuditEvent` |
| Snapshot model | `isCurrent`, `amendmentSequence`, `supersededAt` |
| Rate limits | Lifecycle and transcript limiters |
| Tests | `academicPermissions.policy.test.js`, `gradeLifecycle.amend.e2e.test.js` |

**Capability matrix (summary)**

| Capability | Student | TA | Teacher | Dept admin | Registrar | Admin |
|------------|---------|-----|---------|------------|-----------|-------|
| grade_draft | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| post_grades | — | — | ✓* | ✓ | ✓ | ✓ |
| finalize / amend / recompute | — | — | — | ✓ | ✓ | ✓ |

\*Teacher: own course only for post.

---

### Wave C — Amendment & recompute (Phases 5, 8 partial)

**Goal:** Explicit recompute with dry-run; transcript issuance metadata.

| Deliverable | Details |
|-------------|---------|
| `POST /api/grading-policy/transcript/recompute` | `dryRun` (default true), `reason`, `forceAmend` for finalized terms |
| `transcriptHash.cjs` | Deterministic SHA-256 over sorted course rows |
| `TranscriptIssueLog` | Official issuance records |
| `POST /api/reports/transcript/issue` | Registrar issuance + hash |
| Student transcript | Includes `transcriptHash` in response |
| Tests | `transcriptRecompute.e2e.test.js`, `transcriptHash.policy.test.js` |

**Recompute rules**

- **Dry-run:** Compare live calculation vs frozen snapshot; no writes.
- **Apply (non-finalized):** Update current snapshots + audit event.
- **Apply (finalized):** Requires `forceAmend: true` + `reason` → full amend workflow.

---

### Wave D — Async & scale (Phases 6–7, 12 partial)

**Goal:** BullMQ jobs, batch operations, server-side export, pagination.

| Deliverable | Details |
|-------------|---------|
| BullMQ + `AsyncJob` model | Inline fallback when no Redis / `FORCE_INLINE_JOBS` |
| Worker | `npm run worker:grading-jobs` |
| Job types | `grades.finalize`, `grades.recompute`, `transcript.regenerate`, `export.gradebook` |
| `GET /api/jobs/:id` | Status + progress |
| `GET /api/jobs/:id/download?token=` | Signed gradebook export |
| Paginated gradebook | `GET /api/grades/course/:id/gradebook?page&pageSize` |
| Async threshold | `GRADING_ASYNC_STUDENT_THRESHOLD` (default 50 students) |
| Policy memoization | Per-request `policyCache` in `getResolvedPolicyForCourse` |
| Tests | `jobQueue.policy.test.js`, `gradingJobs.e2e.test.js` |

---

### Wave E — Observability & tooling (Phases 9–10, 15 partial)

**Goal:** Unified audit timeline, provenance UI, health enhancements.

| Deliverable | Details |
|-------------|---------|
| `academicAuditTimeline.service.js` | Merges system audit, policy audit, amendments, jobs, lifecycle milestones |
| `GET .../provenance` | Policy chain, engine version, snapshot counts |
| `GET .../audit-timeline` | Chronological feed |
| Frontend | `CourseGradeLifecyclePanel`, `PolicyProvenancePanel`, `AmendmentTimeline` |
| Grading policy modal | **Lifecycle** tab; gradebook lifecycle strip |
| `/health/ready` | Job queue checks + worker deployment note |
| `npm run validate:indexes` | Index validation script |
| Tests | `academicAuditTimeline.policy.test.js`, `auditTimeline.e2e.test.js` |

---

### Wave F — Migrations & docs (Phases 11, 14–15)

**Goal:** Safe data migrations, production runbooks, expanded CI.

| Deliverable | Details |
|-------------|---------|
| Migration CLI | `npm run migrate` / `migrate:dry-run` |
| `MigrationRun` model | Audit log per migration |
| Migrations | `001` lifecycle backfill, `002` isCurrent backfill, `003` index sync |
| `docs/production/` | deployment, scaling, DR, grading-audit-model |
| CI | `.github/workflows/grading-production.yml` (Mongo + tests + migrate dry-run) |
| Boot indexes | Grading models added to `ensureCriticalIndexes` |
| Tests | `migrations.policy.test.js` |

---

## Data model reference

| Collection / model | Purpose |
|--------------------|---------|
| `CourseGradeLifecycle` | Term-level status and finalize metadata |
| `StudentCourseGradeSnapshot` | Frozen grade + full resolved policy snapshot |
| `GradeAmendmentRecord` | Registrar amendment history |
| `SystemAuditEvent` | Cross-cutting audit (lifecycle, recompute, edits while posted) |
| `GradingPolicyAudit` | Institution/course policy change diffs |
| `AsyncJob` | Background job tracking |
| `TranscriptIssueLog` | Official transcript issuance hash |
| `MigrationRun` | One-off migration audit |

---

## API reference (grading & records)

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| GET | `/api/grades/course/:id/lifecycle` | Staff | Current lifecycle + engine version |
| POST | `/api/grades/course/:id/post` | Teacher / registrar | DRAFT → POSTED |
| POST | `/api/grades/course/:id/finalize` | Registrar | Batch freeze + FINALIZED (async if large) |
| POST | `/api/grades/course/:id/amend` | Registrar | Amend finalized term |
| GET | `/api/grades/course/:id/amendments` | Staff | Amendment list |
| GET | `/api/grades/course/:id/audit` | Staff | Legacy audit bundle |
| GET | `/api/grades/course/:id/provenance` | Staff | Policy chain + snapshot stats |
| GET | `/api/grades/course/:id/audit-timeline` | Staff | Unified timeline |
| GET | `/api/grades/course/:id/gradebook` | Instructor | Paginated gradebook |
| POST | `/api/grades/course/:id/gradebook/export` | Instructor | Async XLSX export |
| POST | `/api/grades/course/:id/transcript/regenerate` | Registrar | Regenerate snapshots |
| POST | `/api/grading-policy/transcript/recompute` | Registrar | Dry-run / apply recompute |
| GET | `/api/jobs/:id` | Requester | Job status |
| GET | `/api/jobs/:id/download` | Requester | Signed export download |
| POST | `/api/reports/transcript/issue` | Registrar | Log official issuance |

---

## Test coverage

| Suite | Command | Count |
|-------|---------|-------|
| Backend grading | `npm run test:grading` | 107 tests, 29 suites |
| Shared verify | `npm run verify:grading` | Parity + deprecated calculator guard |
| Frontend grading | `cd frontend && npm run test:grading` | Policy/snapshot/unit tests |

**Representative E2E scenarios covered**

- DRAFT → POSTED → FINALIZED; policy change does not alter frozen transcript  
- Registrar amend preserves historical snapshot rows  
- Recompute dry-run / apply guards (403 without forceAmend, 400 without reason)  
- TA cannot post; teacher cannot recompute  
- Async finalize and gradebook export jobs  
- Provenance and audit-timeline HTTP  
- Migration dry-run vs apply  

---

## Production deployment checklist (abbreviated)

1. Set env: `MONGODB_URI`, `JWT_SECRET`, `REDIS_URL`, `REQUIRE_REDIS`, `REQUIRE_JOB_QUEUE` (as needed).  
2. Run `npm run build`, `verify:grading`, `test:grading`.  
3. Staging: `migrate:dry-run` → review → `migrate`.  
4. Deploy API + `worker:grading-jobs` + frontend.  
5. Verify `/health/ready`, gradebook lifecycle panel, sample transcript hash stability.  

Full checklist: [production-checklist.md](../production-checklist.md).

---

## Constraints honored

| Constraint | Status |
|------------|--------|
| No rewrite of `calculateFinalGradeWithWeightedGroups` | ✓ |
| No arbitrary scripting / custom formulas | ✓ |
| No silent migration of historical grades | ✓ |
| Append-only finalized snapshots | ✓ |
| `shared/grading` as single source of truth | ✓ |
| Backward compatibility for legacy courses | ✓ |

---

## Known limitations & future work

| Area | Notes |
|------|-------|
| `department_admin` scoping | Same course-level caps as registrar; no department boundary yet |
| Frontend recompute UI | API complete; no dedicated registrar recompute screen |
| `AMENDED` lifecycle status | Amend flow keeps status `FINALIZED`; amendment tracked via records |
| Load benchmarks | 500-student perf tests planned as nightly CI (non-blocking) |
| Institution policy + finalized | Course policy blocked; institution-wide block not enforced globally |

---

## Key file index

| Area | Paths |
|------|-------|
| Shared grading | `shared/grading/` (calculator, policySnapshot, policyDiff, gradingEngineVersion, transcriptHash) |
| Lifecycle | `services/gradeLifecycle.service.js`, `models/courseGradeLifecycle.model.js` |
| RBAC | `middleware/academicPermissions.js` |
| Recompute | `services/transcriptRecompute.service.js` |
| Jobs | `services/jobQueue.service.js`, `workers/gradingJobsWorker.js` |
| Audit | `services/academicAudit.service.js`, `services/academicAuditTimeline.service.js` |
| Gradebook | `services/gradebookData.service.js`, `services/gradebookExport.service.js` |
| Migrations | `scripts/migrations/` |
| Frontend UI | `frontend/src/components/grades/CourseGradeLifecyclePanel.tsx`, `PolicyProvenancePanel.tsx`, `AmendmentTimeline.tsx` |
| Docs | `docs/production/` |
| CI | `.github/workflows/grading-production.yml`, `.github/workflows/predeploy.yml` |

---

## Sign-off summary

The institutional grading production readiness program (Waves A–F) is **complete** for the planned scope. The system now supports registrar-grade lifecycle control, immutable transcript snapshots with full policy provenance, explicit recompute and amend paths, async scale for large courses, unified observability, and documented production operations with tested migrations.

For operational runbooks, start at [docs/production/README.md](./README.md).
