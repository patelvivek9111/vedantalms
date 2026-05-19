# Incident response (grading / transcripts)

## Severity levels

| Level | Example | Response |
|-------|---------|----------|
| S1 | Wrong finalized grades mass-issued | Stop finalize jobs; registrar amend with documented reason |
| S2 | Export token leak suspicion | Rotate `JOB_DOWNLOAD_SECRET`; invalidate Redis if used |
| S3 | Redis outage | API falls back to inline jobs; scale workers after recovery |

## First steps

1. Check `/health/ready` and `/health/dependencies`.
2. Review `/api/ops/dashboard` (admin/registrar) for failed async jobs.
3. Run `npm run verify:audit-integrity` and `npm run verify:snapshots` against staging clone.

## Grading dispute workflow

See [grading-dispute-investigation.md](./grading-dispute-investigation.md).
