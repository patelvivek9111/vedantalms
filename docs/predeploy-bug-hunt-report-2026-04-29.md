# Pre-Deploy Bug Hunt Report (2026-04-29)

## Scope Executed
- Baseline quality gates (install/build/smoke/test/audit)
- High-risk sweep (auth, inbox, pages authorization path, socket/redis behavior, meeting integrations quick-read)
- Functional/regression verification through full backend test suite and targeted suites
- Day1-Day5 reliability/performance scripts
- Observability stack bring-up and endpoint health checks
- Security/readiness checks tied to release checklist

## Changes Made During Bug Hunt
1. `utils/cache.js`
   - Disabled cache usage automatically in test mode.
   - Added fail-fast redis config and disable-on-error behavior to avoid request hangs when redis is unreachable.
2. `tests/inbox.test.js`
   - Made the "non-participant" case deterministic by creating the secondary user directly and cleaning previous residue first.
3. `controllers/page.controller.js`
   - Hardened module/course authorization guard to avoid null dereference and correctly return `403` instead of `500`.

## Baseline Gate Results
- `npm ci` (root/frontend): **failed** due to Windows file lock (`EPERM unlink` on native binaries).
- `npm install` (root): **passed** (used as fallback to restore dependencies).
- `npm run build`: **passed**.
- `npm run smoke:predeploy`: **failed** on redis dependency (`Connection is closed.`).
- `npm run audit:duplicates`: **passed** (`No duplicate basename components found.`).
- `npm test -- --runInBand`: **passed** (`26/26 suites`, `282/282 tests`) after fixes.

## Functional/Regression Results
- Targeted:
  - `tests/pages.test.js` + `tests/inbox.test.js`: **passed**
  - `tests/auth.test.js` + `tests/security.test.js` + `tests/quizwave.test.js`: **passed**
- Full suite:
  - **passed**: `26/26 suites`, `282/282 tests`
- Known non-blocking test hygiene:
  - Jest still reports open handles on teardown in some runs.

## Reliability/Performance Script Results
- `check:day1`: **failed** due to redis connection refusal on localhost:6379.
- `check:day2`, `check:day2:synthetic`, `check:day2:alerts`: **passed**.
- `check:day3`: **passed**; mixed warm/cold endpoint improvements (some regressions).
- `check:day4`: **warning** redis adapter disabled; multi-node validation not fully satisfied.
- `check:day4:pair`: **failed** (`fetch failed`).
- `check:day5`: **passed** with no errors across phases.
- `check:day5:api`: **completed**, no request errors, but significant throttling (`429`) at higher concurrencies and increased p95.

## Observability Validation
- `npm run obs:up`: **passed** (prometheus/alertmanager/grafana containers started).
- Endpoint checks:
  - `GET /health`: OK
  - `GET /health/ready`: ready (mongo true, redis adapter false)
  - `GET /metrics`: 200
  - Prometheus ready endpoint: OK
  - Alertmanager ready endpoint: OK
  - Grafana health endpoint: database OK
- Log finding:
  - Alertmanager log includes historical slack notify misconfiguration (`404 no_service`) that should be corrected before production paging reliance.

## Security/Readiness Findings
- Auth and permission tests are green in automated suite.
- Invalid ID and malformed input paths are largely validated by tests.
- Redis behavior remains the main runtime resilience risk:
  - App works in degraded mode.
  - Predeploy smoke fails when redis URL is configured but redis unavailable.
  - Socket redis adapter remains disabled (`redisAdapterEnabled: false`).

## Deployment Gate Decision
- **Status: NO-GO (for production right now)** due to blocking readiness issues:
  1. `smoke:predeploy` failing on redis connectivity.
  2. `check:day1` and `check:day4:pair` failing.
  3. CI/install reproducibility risk (`npm ci` file-lock EPERM on this Windows host).

## Required Actions Before Production Deploy
1. Ensure redis availability and connectivity from app runtime (or make redis optional everywhere in smoke criteria intentionally).
2. Re-run and pass:
   - `npm run smoke:predeploy`
   - `npm run check:day1`
   - `npm run check:day4:pair`
3. Resolve local install reproducibility:
   - unblock `npm ci` file locks (close locking processes/AV exclusions/admin shell as needed).
4. Confirm alert routing configuration (Alertmanager Slack/webhook target).
5. Re-run full tests (`npm test -- --runInBand`) and confirm stability.

## Suggested Immediate Next Command Sequence
```bash
npm run obs:down
# fix redis connectivity/configuration
npm ci
cd frontend && npm ci && cd ..
npm run smoke:predeploy
npm run check:day1
npm run check:day4:pair
npm test -- --runInBand
```
