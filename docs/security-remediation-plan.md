# Security Remediation Plan

This file tracks the vulnerabilities and security issues found during the free internal pentest pass. Check items off here as fixes are completed and verified.

## Summary

- [x] Fix 52 dependency vulnerabilities reported by `npm audit`
- [x] Fix 9 codebase/configuration security issues
- [x] Fix 7 round-2 re-pentest gaps (code fixes complete; 2 operational items remain for deploy)
- [x] Fix 3 round-3 re-pentest gaps (group route auth, health/dependencies, attendance export consistency)
- [x] Fix 4 round-4 re-pentest gaps (group set/course IDOR on list endpoints)
- [x] Rerun automated security-related tests after fixes
- [x] Rerun dependency audits after fixes
- [x] Run Gitleaks secret scan (local + CI); 2 historical findings documented and ignored pending key rotation
- [ ] Run remaining external tooling: OWASP ZAP, Trivy, Semgrep

**Dependency status (2026-07-03):** `npm audit` reports **0 vulnerabilities** in both backend and frontend.

## Dependency Vulnerabilities

Source: `npm audit` in the repository root and `frontend/`.

| Severity | Backend (before) | Frontend (before) | Total (before) | After fix |
| --- | ---: | ---: | ---: | ---: |
| High | 11 | 10 | 21 | 0 |
| Moderate | 17 | 12 | 29 | 0 |
| Low | 1 | 1 | 2 | 0 |
| Total | 29 | 23 | 52 | **0** |

### Backend Dependencies

- [x] Run `npm audit fix` in the repository root
- [x] Review any remaining backend advisories after the non-breaking fix
- [x] Manually handle any backend advisories requiring breaking changes
- [x] Rerun `npm audit` and confirm backend count is reduced or documented

Manual follow-up applied after `npm audit fix`:

- Upgraded `nodemailer` to `^9.0.3`
- Added root `overrides.uuid` to `^11.1.1` for `exceljs` transitive dependency

Notable backend packages/advisories to verify:

- [x] `axios`
- [x] `mongoose`
- [x] `multer`
- [x] `nodemailer`
- [x] `socket.io` / `ws`
- [x] `lodash`
- [x] `express` / `body-parser` / `qs`
- [x] `express-rate-limit` / `ip-address`
- [x] `postcss`
- [x] `tmp`
- [x] `uuid` via `exceljs`

### Frontend Dependencies

- [x] Run `npm audit fix` in `frontend/`
- [x] Review any remaining frontend advisories after the non-breaking fix
- [x] Manually handle any frontend advisories requiring breaking changes
- [x] Rerun `npm audit` in `frontend/` and confirm count is reduced or documented

Manual follow-up applied after `npm audit fix`:

- Updated `overrides.uuid` from `^9.0.1` to `^11.1.1`

Notable frontend packages/advisories to verify:

- [x] `axios`
- [x] `dompurify`
- [x] `vite`
- [x] `react-router` / `react-router-dom`
- [x] `lodash` / `lodash-es`
- [x] `socket.io` / `ws`
- [x] `linkify-it`
- [x] `markdown-it`
- [x] `postcss`
- [x] `tmp`

## Codebase And Configuration Issues

### Critical

- [x] Lock down or remove attendance debug routes:
  - `GET /api/courses/:courseId/attendance/test`
  - `POST /api/courses/:courseId/attendance/cleanup`
  - `POST /api/courses/:courseId/attendance/test-save`
  - `POST /api/courses/:courseId/attendance/fix-db`
  - `GET /api/courses/:courseId/attendance/inspect`
- [x] Add tests proving non-admin users cannot access destructive attendance debug routes
- [x] Fix attendance roster leak in `getAttendance`
- [x] Add tests proving students cannot enumerate other students' attendance roster data

### High

- [x] Tighten production CORS to explicit trusted frontend domains only
- [x] Add or update tests for rejected untrusted production origins

### Medium

- [x] Confirm production upload virus scanning config: `CLAMAV_ENABLED=true` (startup warning + `.env.example`)
- [x] Confirm production HTML sanitization config: `MESSAGE_SANITIZER=dompurify` (startup warning + `.env.example`)
- [x] Confirm production metrics protection: `METRICS_TOKEN` (startup warning + `.env.example`)
- [x] Confirm public registration is disabled or restricted for production (startup warning + `DISABLE_PUBLIC_REGISTRATION`)
- [x] Decide whether dev/test rate limiting should be enabled for local security tests with `ENFORCE_RATE_LIMIT_IN_DEV=true` (documented in `.env.example`; off by default in dev)
- [x] Remove hardcoded TinyMCE API key fallback; require `VITE_TINYMCE_API_KEY` or use plain textarea editor
- [ ] Rotate or restrict legacy TinyMCE API key exposed in git history (see Gitleaks section)
- [x] Delete or fix unused `middleware/roleCheck.js`

### Low

- [x] Keep dev JWT fallback blocked in production startup validation
- [x] Review event access consistency between list and detail endpoints

## Round 2 Re-Pentest Gaps (2026-07-03)

Issues found during the follow-up verification pass after the first remediation wave.

### Medium

- [x] Fix frontend `Attendance.tsx` to use student attendance API instead of instructor roster endpoint
- [x] Add `?date=` support to `GET /api/courses/:courseId/attendance/student` for calendar day views
- [x] Restrict `GET /api/courses/:courseId/students` to course grading staff only
- [x] Add tests proving enrolled students cannot enumerate classmate roster data
- [x] Protect `GET /health/ops` with `metricsAuth` in production (same as `/metrics`)

### Low

- [x] Remove production JWT secret fallback from socket authentication (`utils/socketAuth.js`)
- [x] Centralize JWT secret resolution in `utils/jwtSecret.js` (also used by user token signing)
- [x] Remove hardcoded TinyMCE API key fallback; require `VITE_TINYMCE_API_KEY` or use plain textarea editor

### Operational (verify at deploy time)

- [ ] Confirm production env vars are set on live/staging: `CLAMAV_ENABLED`, `MESSAGE_SANITIZER`, `METRICS_TOKEN`, `DISABLE_PUBLIC_REGISTRATION`, `VITE_TINYMCE_API_KEY`
- [ ] Rotate or restrict legacy TinyMCE API key in Tiny Cloud dashboard (Gitleaks found key in commits `f7e521c`, `b4e67e9`)

## Round 3 Re-Pentest Gaps (2026-07-03)

Issues found during the third verification pass.

### Critical

- [x] Add `protect` middleware and authorization to unauthenticated group routes:
  - `GET /api/groups/:groupId/members`
  - `DELETE /api/groups/:groupId/members/:userId`
  - `GET /api/groups/sets/:groupSetId/available-students`
  - `POST /api/groups/:groupId/members`
- [x] Add tests in `tests/unit/api/groups.test.js` proving auth is enforced

### Low

- [x] Protect `GET /health/dependencies` with `metricsAuth` in production (same as `/health/ops`)
- [x] Use `fetchCourseAttendanceForDate` in monthly/custom attendance export loops (consistency with student vs staff APIs)

## Round 4 Re-Pentest Gaps (2026-07-03)

Issues found during the fourth verification pass.

### Medium

- [x] Restrict group list/read endpoints to course members or grading staff:
  - `GET /api/groups/sets/:courseId`
  - `GET /api/groups/sets/:setId/groups` (was leaking member emails to any authenticated user)
  - `GET /api/groups/sets/id/:setId`
  - `GET /api/groups/:groupId`
- [x] Require course grading staff to delete groups (`DELETE /api/groups/groups/:groupId`)
- [x] Harden self-signup: require course access and verify group belongs to group set
- [x] Add tests for outsider rejection on group set list endpoints

## Verification Checklist

- [x] Run `npm audit` from the repository root
- [x] Run `cd frontend && npm audit`
- [x] Run `npm run test:grading`
- [x] Run `npm run test:files`
- [x] Run `npx jest tests/unit/api/security.test.js tests/unit/api/event.test.js --runInBand --forceExit`
- [x] Run broader API tests if auth, CORS, or route middleware changes are broad
- [x] Run frontend tests if dependency updates affect frontend packages
- [x] Run round-2 tests: attendance student date, course roster lockdown, jwtSecret, CORS, startup validation
- [x] Run round-3 tests: group route auth (`tests/unit/api/groups.test.js`)
- [x] Run round-4 tests: group set/course IDOR lockdown (extended `groups.test.js`)
- [x] Run `npm run scan:gitleaks` (git history scan; passes with `.gitleaksignore` for accepted historical findings)

## External Tooling

Priority order: **Gitleaks** → Semgrep → Trivy → OWASP ZAP (all free for basic use).

### Gitleaks (2026-07-03) — complete

- [x] Install Gitleaks locally (`winget install Gitleaks.Gitleaks`)
- [x] Add `.gitleaks.toml` (default rules + generated-artifact exclusions)
- [x] Add `.gitleaksignore` for 2 accepted historical findings
- [x] Add `npm run scan:gitleaks`
- [x] Add CI job in `.github/workflows/hardening-production.yml`
- [x] Gitignore local report files (`gitleaks-report.json`)

**Scan command:**

```bash
npm run scan:gitleaks
```

**Findings (git history):**

| Rule | File | Commits | Status |
| --- | --- | --- | --- |
| `generic-api-key` | `frontend/src/components/RichTextEditor.tsx` | `f7e521c`, `b4e67e9` | Removed from current code; fingerprinted in `.gitleaksignore` |

**Operational follow-up:**

- [ ] In [Tiny Cloud](https://www.tiny.cloud/), rotate or restrict the legacy API key that was hardcoded before the security fix
- [ ] After rotation, remove the two lines from `.gitleaksignore` and confirm `npm run scan:gitleaks` still passes

**Local notes:**

- `.env` secrets are gitignored; never commit `.env`
- `frontend/dist/` may contain old bundled keys from local builds; keep dist gitignored and excluded in `.gitleaks.toml`

### Semgrep — not started

- [ ] Add `semgrep scan --config auto` to CI or run locally
- [ ] Triage findings; fix or document accepted risks

### Trivy — not started

- [ ] Run `trivy fs .` and `trivy config` against Docker/deploy files
- [ ] Compare with `npm audit` (already 0 vulns)

### OWASP ZAP — not started

- [ ] Run baseline scan against staging (`zap-baseline.py -t https://staging-url`)
- [ ] Review XSS, CSRF, cookie, and header findings

## Deferred External Tooling (summary)

These were not completed in the initial pass because the tools were not installed or the local app/database was not fully available.

- [x] Gitleaks secret scan (see **External Tooling → Gitleaks** above)
- [ ] OWASP ZAP baseline scan against staging/local app
- [ ] Trivy filesystem/container scan
- [ ] Semgrep security audit

## Notes

- Dependency audit counts may change after package lock updates.
- Some dependency advisories may be development-only or not exploitable in this app, but each remaining advisory should be explicitly accepted or fixed.
- Do not run destructive pentest actions against production or real student data.
