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
- [x] Run Semgrep static analysis (local + CI); focused node/ts/react rules, 0 blocking findings
- [x] Run Trivy filesystem scan (local + CI); 0 HIGH/CRITICAL vulns or misconfigs
- [x] Run OWASP ZAP baseline (local + CI); 0 FAIL on production URL

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
- [x] Restrict legacy TinyMCE API key via Tiny Cloud **Approved Domains** (rotation is not offered by Tiny Cloud)
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

- [ ] Confirm production env vars are set on live/staging: `CLAMAV_ENABLED`, `MESSAGE_SANITIZER`, `METRICS_TOKEN`, `DISABLE_PUBLIC_REGISTRATION`, `VITE_TINYMCE_API_KEY` (Vercel)
- [x] Vercel security headers deployed on vedantaed.com
- [x] `VITE_TINYMCE_API_KEY` on Vercel + local `frontend/.env.local` (gitignored)
- [x] Post-deploy smoke (`npm run smoke:deploy`) — 4/4 on Render API URL
- [x] Restrict legacy TinyMCE API key in Tiny Cloud **Approved Domains** (`localhost`, `vedantaed.com`, `www.vedantaed.com`; add frontend deploy host if different)

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
- [x] Run `npm run scan:semgrep` (focused node/ts/react rules; 0 blocking findings)
- [x] Run `npm run scan:trivy` (lockfiles + Dockerfiles; HIGH/CRITICAL gate)
- [x] Run `npm run scan:zap` (passive baseline on production; 0 FAIL with `-I`)
- [x] Run `npm run smoke:deploy` against production (`PRODUCTION_API_URL=https://vedantalms-backend.onrender.com`; health, login, courses, todos — 4/4 pass, 2026-07-04)

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

- [x] Restrict key in Tiny Cloud **Approved Domains** (this is the supported mitigation; Tiny Cloud does not offer key rotation)
- [ ] Confirm every **frontend** hostname that loads the editor is listed (browser origin, not API backend). Remove `vedantalms-backend.onrender.com` if the editor is not served from that host.
- [ ] Keep `.gitleaksignore` entries until satisfied the historical exposure is accepted; they document known git-history findings only

**Why there is no “rotate key” button:** TinyMCE Cloud API keys are public client identifiers (visible in browser network traffic), not private secrets. Tiny does not provide rotation/regeneration in the dashboard. Security is enforced by **domain allowlisting**, which you have configured.

**Local notes:**

- `.env` secrets are gitignored; never commit `.env`
- `frontend/dist/` may contain old bundled keys from local builds; keep dist gitignored and excluded in `.gitleaks.toml`

### Semgrep (2026-07-04) — complete

- [x] Install Semgrep locally (`pip install semgrep`)
- [x] Add `.semgrepignore` (scripts, monitoring, `.github`, dist, node_modules)
- [x] Add `npm run scan:semgrep`
- [x] Add CI job in `.github/workflows/hardening-production.yml`
- [x] Gitignore local report files (`semgrep-report.json`, etc.)
- [x] Triage and fix or document findings

**Scan command (focused app rules; not full `--config auto`):**

```bash
npm run scan:semgrep
```

**Strategy:** Full `semgrep scan --config auto` reports ~161 findings, mostly noise from `scripts/`, GitHub Actions mutable tags, and path-traversal heuristics on guarded code. CI uses **p/nodejs**, **p/typescript**, and **p/react** only (~74 rules on tracked app code).

**Findings triaged (5 → 0):**

| Rule | File | Resolution |
| --- | --- | --- |
| `raw-html-format` | `controllers/auth.controller.js` | Password-reset email switched to plain text (no HTML injection surface) |
| `express-path-join-resolve-traversal` | `page.controller.js`, `file.controller.js`, `jobs.controller.js` | `isPathInside` guards + `nosemgrep` where path is validated |
| `react-dangerouslysetinnerhtml` | `AnnouncementDetailModal.tsx` | Server-side DOMPurify sanitization; `nosemgrep` documents accepted risk |

**Optional informational scan (not gated in CI):**

```bash
semgrep scan --config auto --json -o semgrep-report.json
```

### Trivy (2026-07-04) — complete

- [x] Install Trivy locally (`winget install AquaSecurity.Trivy`)
- [x] Add `npm run scan:trivy`
- [x] Add CI job in `.github/workflows/hardening-production.yml`
- [x] Gitignore local report files (`trivy-report.json`, etc.)
- [x] Fix Dockerfile misconfigurations (non-root `USER`)

**Scan command:**

```bash
npm run scan:trivy
```

**What it scans:** `package-lock.json` and `frontend/package-lock.json` for vulnerabilities (prod deps only; aligns with `npm audit` 0/0), plus `Dockerfile` and `Dockerfile.load` for misconfigurations. Secrets are covered by Gitleaks (Trivy secret scan is slower and omitted from CI).

**Findings triaged:**

| Rule | Target | Resolution |
| --- | --- | --- |
| DS-0002 (non-root user) | `Dockerfile`, `Dockerfile.load` | Added `nodejs` user (uid 1001) and `USER nodejs` in final image |

**Optional informational scans (not gated in CI):**

```bash
trivy fs --scanners vuln --include-dev-deps --severity MEDIUM,HIGH,CRITICAL .
trivy config --severity MEDIUM,HIGH,CRITICAL .
```

Docker Compose files are not evaluated by Trivy’s compose scanner in this setup; production compose hardening is documented separately.

### OWASP ZAP (2026-07-04) — complete

- [x] Install/run via Docker (`ghcr.io/zaproxy/zaproxy:stable`)
- [x] Add `npm run scan:zap` (`scripts/scanZap.js`)
- [x] Add `.zap/rules.tsv` for triaged WARN/IGNORE rules
- [x] Add CI job in `.github/workflows/hardening-production.yml`
- [x] Gitignore local reports (`zap-report.html`, `zap-report.json`)
- [x] Harden `vercel.json` security headers (CSP, X-Frame-Options, etc.)

**Scan command (requires Docker running):**

```bash
npm run scan:zap
# ZAP_TARGET=https://vedantaed.com npm run scan:zap
```

**Target:** `https://vedantaed.com` (passive baseline only — no active attack or authenticated flows). API routes are proxied via Vercel rewrites; scan is intentionally limited to the public surface.

**Results (2026-07-04 baseline):**

| Level | Count | Notes |
| --- | ---: | --- |
| FAIL | **0** | No high-confidence vulnerabilities |
| WARN | 4 → 0 after deploy | Missing security headers on live Vercel until `vercel.json` headers ship |
| IGNORE | 6 | CDN/cache/CORS/SPA noise documented in `.zap/rules.tsv` |
| PASS | 57 | HSTS, cookies, XSS passive checks, etc. |

**Header hardening (pending Vercel deploy):** `vercel.json` now sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` on all routes. Re-run `npm run scan:zap` after deploy to confirm WARNs clear.

**CI behavior:** `cmd_options: '-I'` — job fails only on **FAIL**-level alerts, not WARN/INFO.

## Deferred External Tooling (summary)

All four free external tools from the remediation plan are now integrated:

- [x] Gitleaks secret scan
- [x] Semgrep static analysis
- [x] Trivy filesystem/container scan
- [x] OWASP ZAP baseline scan

## Notes

- Dependency audit counts may change after package lock updates.
- Some dependency advisories may be development-only or not exploitable in this app, but each remaining advisory should be explicitly accepted or fixed.
- Do not run destructive pentest actions against production or real student data.
