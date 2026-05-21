# Rollback runbook

1. Stop grading workers and file maintenance workers.
2. Revert application image/tag to previous release.
3. Run `npm run verify:production-health` against rolled-back build.
4. If schema migration ran, apply down migration only if idempotent script exists; otherwise restore Mongo from pre-deploy snapshot.
5. Invalidate download tokens: ops recovery → integrity report.
6. Reconcile stuck async jobs via admin recovery panel or `retry_job` action.
7. Notify registrars if transcript issue window overlapped rollback period.
