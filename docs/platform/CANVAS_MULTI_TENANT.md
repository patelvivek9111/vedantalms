/**
 * Canvas-style multi-institution platform (MySl8te)
 *
 * Single source of truth for Phases 1–5.
 * Related: docs/registrar/FULL_REGISTRAR_ROADMAP.md
 */

# Overview

One repo, one product, many institutions (Canvas Cloud model). Schools are **Accounts**
(tenants), not separate deploys.

| Phase | Status | Focus |
|-------|--------|--------|
| 1 | Done | Account tree, Host → tenant, `rootAccountId` isolation |
| 2 | Done | Memberships, Pseudonyms, invites, branded login, Contact → provision |
| 3 | Done | AcademicTerm, CourseOffering, CourseSection, cross-lists |
| 4 | Done | Enrollment of record, holds, SIS stage/apply, registrar APIs |
| 5 | Done | Quotas, domains/TLS hooks, jobs/files tenancy, ops, impersonation |

---

# Phase 1 — Account platform + hard tenancy

**Implemented:** 2026-07-22

## Models
- `Account` — root + sub-accounts (tree)
- `AccountDomain` — hostname → root
- `AccountBrand`, `AccountFeatureFlag`
- `SystemSettings` / `InstitutionGradingPolicy` / `User` / `Course` / `FileAsset` — `rootAccountId`

## Runtime
- `middleware/tenant.js` — Host / `X-Account-Id` → `req.rootAccountId`
- Cross-tenant JWT rejected (except `platform_admin`)
- Boot: `ensureDefaultRootAccount()` + orphan backfill

## APIs
- `GET /api/tenant/current`
- `GET|POST /api/platform/accounts`
- `POST /api/platform/feature-flags`
- `POST /api/platform/ensure-default-account`

## Ops
```bash
node scripts/backfillRootAccountId.js
```

Env: `DEFAULT_ROOT_ACCOUNT_CODE`, `DEFAULT_ROOT_ACCOUNT_NAME`, `DEFAULT_TENANT_HOST`, `TENANT_EXTRA_HOSTS`

## Exit criteria
1. Default deploy = root `DEFAULT`
2. Host A never lists Host B courses
3. Email unique per root
4. `platform_admin` ≠ school `admin`

---

# Phase 2 — Identity, memberships, front door

**Implemented:** 2026-07-22

## Models
- `AccountUser`, `Pseudonym`, `AuthenticationProvider`, `RoleOverride`
- `AccountInvite`, `ContactLead`

## Services
- `services/tenancy/accountMembership.service.js`
- `services/tenancy/accountPermissions.service.js`
- `services/tenancy/provisionAccount.service.js`

## APIs
| Method | Path | Access |
|--------|------|--------|
| POST | `/api/admin/users` | School admin (no session swap) |
| POST | `/api/admin/invites` | School admin |
| GET | `/api/auth/invites/:token` | Public |
| POST | `/api/auth/accept-invite` | Public |
| GET | `/api/platform/leads` | platform_admin |
| POST | `/api/platform/leads/:id/provision` | platform_admin |

## Frontend
- `TenantProvider` + branded `/login`
- `/accept-invite`

## Exit criteria
1. School admin only sees own users
2. Same email OK on two roots (Host-scoped login)
3. Invite → membership in inviting root
4. Lead → provisioned institution
5. Login shows `AccountBrand`

---

# Phase 3 — Academic structure (terms, catalog, sections)

**Implemented:** 2026-07-23

## Models
- `AcademicTerm` — institution enrollment term registry (`status`, enrollment open/close)
- `CourseOffering` — catalog course under an account/dept (`courseCode`, credits, …)
- `CourseSection` — term instance linked to LMS `Course` via `lmsCourseId`
- `CrossListGroup` — shared content / gradebook across sections

## Course dual-write
Existing `Course` keeps `semester` / `scheduleType` for UX. Added:
- `academicTermId`, `offeringId`, `sectionId`, `sectionNumber`
- Create course → resolve/create term + offering + section automatically

## Services
- `services/tenancy/academicStructure.service.js`
  - `resolveOrCreateTermFromSemester`
  - `ensureOfferingAndSectionForCourse`
  - `assertTermEnrollmentOpen`
  - `accountSubtreeFilter` (sub-account catalog visibility)

## APIs (`/api/academic-structure`)
| Method | Path | Roles |
|--------|------|--------|
| GET/POST | `/terms` | list: auth; write: admin/registrar/dept_admin |
| PATCH | `/terms/:id` | admin/registrar/dept_admin |
| GET/POST | `/offerings` | write includes teacher |
| PATCH | `/offerings/:id` | |
| GET/POST | `/sections` | |
| POST | `/courses/:courseId/link-structure` | link legacy course |
| POST | `/cross-lists` | registrar/admin |

Also:
- Catalog supports `?termId=` / `?accountId=` and returns term enrollment open flag
- Course list supports `?termId=` / `?accountId=`
- Admin `GET /api/admin/courses` is **tenant-scoped** (+ optional term/account)
- Self-enroll blocked when term enrollment window is closed

## Ops
```bash
node scripts/backfillAcademicStructure.js
```

## Exit criteria
1. Terms exist per root; enrollment open/close enforced
2. Courses attach to `academicTermId` (legacy semester still works)
3. Offerings + sections link to LMS Course
4. Sub-account filter limits catalog/offerings to subtree
5. Cross-list group can bind multiple sections

---

# Phase 4 — Enrollment of record, holds, SIS

**Implemented:** 2026-07-23

## Models
- `Enrollment` — authoritative enrollment of record (status history, SIS id, section/term links)
- `StudentHold` — registration / transcript / grade holds (`hasBlockingHold`)
- `SisStagingEnrollment` — tenant-scoped staged import rows
- `SisJob` — import job metadata per root
- `CourseGradeLifecycle` / `TranscriptIssueLog` — `rootAccountId` for tenant-scoped finalize/issue

## Dual-write strategy
Teaching UX continues to read `Course.students[]`. Roster mutations also write `Enrollment`:
- Teacher enroll / unenroll / waitlist promote
- Self-enroll / self-unenroll
- Approve enrollment request
- Registrar bulk enroll / drop
- SIS apply

Cross-tenant student → course enrollments are rejected.

## Services
- `services/registrar/enrollmentWrite.service.js` — activate / deactivate / conclude / sync
- `services/sis/index.js` — `stageEnrollmentImport`, `applyStagingBatch` (tenant-scoped)

## Holds
- Self-enroll blocked when `blocksRegistration`
- Official transcript issue blocked when `blocksTranscript`
- Registrar may still enroll (override) except cross-tenant

## APIs (`/api/registrar`)
| Method | Path | Capability |
|--------|------|------------|
| GET | `/terms/:termId/enrollments` | manage_enrollments |
| GET | `/sections/:sectionId/roster` | manage_enrollments |
| POST | `/enrollments/bulk` | manage_enrollments |
| POST | `/enrollments/drop` | manage_enrollments |
| POST | `/terms/:termId/conclude` | manage_enrollments |
| POST | `/courses/:courseId/sync-roster` | manage_enrollments |
| GET | `/reports/enrollment-summary` | view_lifecycle |
| GET/POST | `/holds` | manage_holds |
| POST | `/holds/:id/release` | manage_holds |
| POST | `/sis/stage` | manage_sis |
| GET | `/sis/staging` | manage_sis |
| POST | `/sis/apply` | manage_sis |
| GET | `/sis/jobs` | manage_sis |

Existing `/api/registrar/reports/*` is now tenant-scoped on lifecycle rows.

## Frontend
- Thin `/registrar` page — enrollment summary + holds (admin/registrar)

## Ops
```bash
node scripts/backfillEnrollmentsFromCourses.js
```

## Tests
```bash
npx jest tests/unit/api/tenancy.phase4.test.js
```

## Exit criteria
1. Enrollment row exists for roster adds; drops update status
2. Host A cannot list Host B enrollments / SIS batches
3. Registration hold blocks self-enroll
4. Transcript hold blocks official issue
5. SIS stage → apply creates tenant-scoped Enrollment + roster
6. Teaching UX still uses `Course.students` (no read rewrite required)

---

# Phase 5 — Platform ops, quotas, scale hardening

**Implemented:** 2026-07-23

## Models
- `AccountQuota` — planCode, maxSeats, maxStorageBytes, apiRateLimitPerMinute
- `Account.planCode` + `workflowState` suspend/reactivate via platform API
- `AccountDomain` — `verificationToken`, `tlsStatus`, cert expiry hooks
- `SupportImpersonationSession` — platform masquerade with audit
- `AsyncJob.rootAccountId` (required on enqueue)
- `SystemAuditEvent.rootAccountId`

## Quotas & rate limits
- `services/tenancy/accountQuota.service.js` — seats, storage, per-minute API
- Seat checks on `POST /api/admin/users` and invites
- Hard tenant storage cap in `fileQuota.service.js` (tenant-scoped aggregates)
- `middleware/tenantRateLimit.js` after Host resolve (Redis; skip if unavailable)

## Domains / TLS
- `services/tenancy/domainTls.service.js` — add domain, TXT challenge stub, verify, `TLS_PROVISION_WEBHOOK_URL` hook
- Dev: verify with `force` → `tlsStatus=active`

## Jobs & files
- `enqueueJob` stamps `rootAccountId`; workers `runWithTenant` and reject missing tenant
- `export.institution` job type for offboarding
- Storage keys: `{rootAccountId}/academic/...`
- `FileAsset.rootAccountId` on create; download tokens include root; cross-tenant access denied

## Export / offboard
- `exportInstitutionBundle({ rootAccountId })` scopes users/courses/enrollments/settings/files
- `POST /api/platform/accounts/:id/export`
- `POST /api/platform/accounts/:id/offboard` — export then suspend

## Impersonation
- `POST /api/platform/impersonate` / `.../end` / `GET .../impersonate/audit`
- JWT carries `impersonatorId`; audit actions `impersonation_started|ended`

## Observability & shards
- Request logs include `rootAccountId`, `tenantHost`, `impersonating`
- `config/tenantShardMap.js` — connection map stub (primary until configured)

## Platform APIs (platform_admin)
| Method | Path |
|--------|------|
| PATCH | `/platform/accounts/:id` (suspend, plan, name, …) |
| GET/PUT | `/platform/accounts/:id/quota` |
| POST | `/platform/accounts/:id/domains` |
| POST | `/platform/accounts/:id/domains/:domainId/verify-request` |
| POST | `/platform/accounts/:id/domains/:domainId/verify` |
| POST | `/platform/accounts/:id/export` |
| POST | `/platform/accounts/:id/offboard` |
| POST | `/platform/impersonate` |
| POST | `/platform/impersonate/end` |
| GET | `/platform/impersonate/audit` |

## Tests
```bash
npx jest tests/unit/api/tenancy.phase5.test.js --forceExit
```

## Exit criteria
1. New institution provisioned with plan + quota in minutes (no new repo)
2. Suspended host returns 404 (no fallback leak)
3. Seat / storage quotas enforce per root
4. Jobs without `rootAccountId` fail; workers re-check tenant
5. File keys/tokens tenant-bound
6. Tenant export excludes other roots
7. Impersonation audited and tenant-scoped
8. Shard map resolves DEFAULT → primary

---

# Still deferred (post Phase 5)

_None from the original Canvas tenancy backlog — completed 2026-07-23:_

| Item | Status |
|------|--------|
| Live SAML/OIDC login UI | Done — `/api/auth/sso/*`, Login SSO buttons, `openid-client` + SAML ACS |
| Full sub-account admin console | Done — `/admin/accounts` + `/api/admin/accounts` tree |
| Richer Registrar / SIS UI | Done — `/registrar` tabs (summary, enrollments, holds, SIS) |
| `rootAccountId` on course-child collections | Done — `courseChildTenantPlugin` + `scripts/backfillCourseChildRootAccountId.js` |
| Teaching UX reads from Enrollment | Done — `rosterRead.service` for roster + gradebook |
| Real ACME/TLS automation | Done — `acme-client`, HTTP-01 `/.well-known/acme-challenge`, DNS TXT verify, webhook callback |
| Runtime dedicated DB shards | Done — `services/db/shardRegistry.js` warms mapped shards at boot |

### Ops notes
- OIDC: configure `AuthenticationProvider` with `settings.clientId/clientSecret/issuerUrl`
- ACME: set `ACME_ENABLED=true`, `ACME_EMAIL`, optional `ACME_STAGING=true`
- Shards: map `accountCode` in `config/tenantShardMap.js` + env URI key
- Backfill children: `node scripts/backfillCourseChildRootAccountId.js`
