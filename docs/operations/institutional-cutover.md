# Institutional cutover

1. Run `npm run verify:institution-ready` on staging.
2. Freeze grade finalization during cutover window.
3. Export institution bundle; verify restore parity on staging clone.
4. Deploy application; run post-deploy checklist in `docs/release/deployment-validation-checklist.md`.
5. Enable workers: `worker:grading-jobs`, `worker:file-maintenance`.
6. Smoke-test course copy wizard, archive center, and secure file preview.
