# Deployment validation checklist

## Pre-deploy

- [ ] `npm run verify:production-health` passes
- [ ] `npm run verify:index-integrity` passes
- [ ] `npm run test:institutional-workflows` passes
- [ ] `npm run verify:grading` passes
- [ ] Redis reachable (or documented degraded mode)
- [ ] MongoDB backups verified within RPO

## Post-deploy

- [ ] Login (student, instructor, registrar, admin)
- [ ] Secure file upload + preview on assignment
- [ ] Discussion reply attachment upload
- [ ] Course archive → student upload blocked
- [ ] Course copy job completes (async)
- [ ] Ops dashboard + recovery dry-run
- [ ] Grade finalize + transcript fetch

## Data safety

- [ ] No duplicate lifecycle rows after copy
- [ ] Transcript snapshots append-only after deploy
- [ ] Audit events for archive/copy/attachment remove
