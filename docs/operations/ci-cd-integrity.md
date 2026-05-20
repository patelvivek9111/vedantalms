# CI/CD integrity (Vedanta LMS)

This document describes how predeploy GitHub Actions, grading verification, and smoke checks are wired — and how to debug common failures without changing grading or transcript behavior.

## Why `secrets` cannot be used in workflow `if:`

GitHub Actions evaluates step and job `if:` conditions **before** the job runs. The `secrets` context is only available **inside** a running job (for `env:` and `run:`), not at workflow parse time.

Invalid (workflow file rejected, **zero jobs start**):

```yaml
- if: ${{ secrets.MONGODB_URI != '' }}
  run: npm run smoke:predeploy
```

Valid pattern (step always declared; skip inside shell):

```yaml
- name: Run smoke check (optional)
  env:
    MONGODB_URI: ${{ secrets.MONGODB_URI }}
  run: |
    if [ -z "$MONGODB_URI" ]; then
      echo "Skipping smoke test because MONGODB_URI secret is not configured"
      exit 0
    fi
    npm run smoke:predeploy
```

## Required workflows

| File | Purpose |
|------|---------|
| `.github/workflows/predeploy.yml` | Build, grading verify, migration + policy tests, optional smoke |
| `.github/workflows/grading-production.yml` | Grading matrix on grading-related paths |
| `.github/workflows/hardening-production.yml` | Institutional hardening checks |

Validate locally:

```bash
npm run verify:workflows
```

## Required GitHub secrets (optional smoke)

| Secret | Required for | Notes |
|--------|----------------|-------|
| `MONGODB_URI` | Full smoke check | If unset, CI skips smoke (exit 0) |
| `REDIS_URL` | Redis ping in smoke | Skipped when unset unless `REQUIRE_REDIS=true` |
| `JWT_SECRET` | Auth-heavy deploy paths | Smoke logs a **warning** if unset; does not fail predeploy |

Repository → **Settings → Secrets and variables → Actions**.

## Local dry-run (mirror predeploy job)

From repo root:

```bash
npm ci
cd frontend && npm ci && npm run build && cd ..
npm run verify:workflows
npm run verify:grading
npm run test:migration
npm run test:grading
cd frontend && npm run test:grading
```

Smoke (optional):

```bash
# Skip path (no env)
node scripts/predeploySmokeCheck.js

# Full path
set MONGODB_URI=mongodb://127.0.0.1:27017/lms   # Windows example
npm run smoke:predeploy
```

## Workflow validation process

`scripts/validateWorkflowFiles.js` checks:

1. Required workflow files exist
2. Each `.github/workflows/*.yml` parses as YAML
3. Top-level `name`, `on`, and `jobs` are present
4. No `if: ${{ secrets.* }}` (or bare `if: secrets.*`)

Automated test: `tests/ci/workflowValidation.test.js`

## Smoke-test fallback behavior

`scripts/predeploySmokeCheck.js` reports explicit statuses:

| status= | Meaning | Exit code |
|---------|---------|-----------|
| `skipped` | `MONGODB_URI` (or Redis URL) not configured | 0 |
| `warning` | Non-blocking issue (e.g. Redis unreachable when `REQUIRE_REDIS` is not `true`, or `JWT_SECRET` unset) | 0 |
| `success` | Mongo (+ Redis when configured) OK | 0 |
| `failure` | Required dependency check failed | 1 |

## Grading verification (`verify:grading`)

Canonical engine: **`calculateFinalGradeWithWeightedGroups`**.

`getWeightedGradeForStudent` remains exported from shared modules **only** for legacy compatibility. CI blocks new production usage via `scripts/checkDeprecatedGradingCalculator.js`; allowed definition sites:

- `shared/grading/gradeCalculation.cjs`
- `shared/grading/gradeCalculation.mjs`
- Type declarations in `shared/grading/index.d.ts`

## Common deployment failures

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| “Invalid workflow file… Unrecognized named-value: 'secrets'” | `secrets` in `if:` | Use shell gating (see above) |
| Workflow graph empty / 0 jobs | Same YAML parse error | `npm run verify:workflows` |
| `verify:grading` fails on deprecated calculator | New call/import outside allowlist | Use canonical calculator in app code |
| Smoke fails on Mongo | Bad URI / network / Atlas IP allowlist | Fix `MONGODB_URI` secret or connectivity |
| Smoke warns on Redis | Redis down but not required | Set `REDIS_URL` or accept warning when `REQUIRE_REDIS=false` |

## What this pipeline does **not** change

Predeploy and workflow fixes do **not** modify:

- `calculateFinalGradeWithWeightedGroups` behavior
- Transcript snapshot semantics
- Grade lifecycle / finalization logic
- Frontend UI

They only restore CI parse validity, optional smoke gating, and deployment guards.
