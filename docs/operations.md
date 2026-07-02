# Operations runbook

Day-to-day ops, incidents, backup/restore, migrations, and subsystem maintenance.

---

## Backend development lifecycle

**Process model:** `nodemon` is the only restart authority. `scripts/devServer.js` acquires dev lock, prepares port 5000, starts `server.js`. `scripts/stopDev.js` stops lingering processes and clears stale locks.

```powershell
npm run stop:dev
npm run dev
```

**Diagnostics:** `npm run verify:dev-lifecycle` (read-only — process counts, port 5000, lock owner).

**Workers** (run separately; API does not start schedulers by default):

```powershell
npm run worker:quizwave-cleanup
npm run worker:timed-quiz-sweep
npm run worker:grading-jobs
```

Set `ENABLE_API_SCHEDULERS=true` only for single-process local experiments.

**Health:** `/health/live`, `/health/ready`, `/health/ops` — Redis adapter failures are degraded unless `REQUIRE_REDIS=true`.

---

## CI/CD integrity

GitHub Actions cannot use `secrets` in workflow `if:` — gate inside shell instead:

```yaml
env:
  MONGODB_URI: ${{ secrets.MONGODB_URI }}
run: |
  if [ -z "$MONGODB_URI" ]; then exit 0; fi
  npm run smoke:predeploy
```

**Key workflows:** `predeploy.yml`, `grading-production.yml`, `hardening-production.yml`. Validate locally: `npm run verify:workflows`.

**Smoke statuses:** `skipped` (no Mongo) → 0; `warning` (Redis/JWT) → 0; `failure` → 1.

**Grading CI:** canonical engine is `calculateFinalGradeWithWeightedGroups`; deprecated calculator blocked by `scripts/checkDeprecatedGradingCalculator.js`.

| Symptom | Fix |
|---------|-----|
| `secrets` in `if:` | Shell gating |
| `verify:grading` deprecated calculator | Use canonical calculator |
| `migrate:dry-run` fails | Add Mongo service + `MONGODB_URI` |
| Smoke Mongo fail | Fix URI / Atlas IP allowlist |

---

## Incident response (grading / transcripts)

| Level | Example | Response |
|-------|---------|----------|
| S1 | Wrong finalized grades mass-issued | Stop finalize jobs; registrar amend |
| S2 | Export token leak | Rotate `JOB_DOWNLOAD_SECRET` |
| S3 | Redis outage | Inline job fallback; scale workers after recovery |

**First steps:** `/health/ready`, `/health/dependencies`, admin ops dashboard for failed jobs, `npm run verify:audit-integrity` and `npm run verify:snapshots` on staging clone.

---

## Institution backup

```bash
npm run export:institution
node scripts/exportInstitutionBundle.js --sections=users,courses,gradeSnapshots,transcriptSnapshots,policyAudits
node scripts/exportInstitutionBundle.js --batch-id=export-<timestamp>   # resume
```

**Verify:**

```bash
npm run verify:institution-export -- uploads/exports/institution/<batchId>
npm run verify:backup-compatibility -- uploads/exports/institution/<batchId>
npm run verify:data-integrity
```

**Acceptance:** `manifest.json` with `exportVersion` `2.0.0`; checksum valid; no passwords in `users.json`; copy archive off-app-server.

---

## Institution restore

**Prerequisites:** verified bundle, staging first, `verify:backup-compatibility` passed.

```bash
node scripts/restoreInstitutionBundle.js <batchId> --validate-only
node scripts/restoreInstitutionBundle.js <batchId> --dry-run --skip-existing
node scripts/restoreInstitutionBundle.js <batchId> --remap-ids --skip-existing   # new environment
node scripts/restoreInstitutionBundle.js <batchId> --merge --sections=courses,modules
```

| Flag | Behavior |
|------|----------|
| `--validate-only` | Manifest + hash only |
| `--dry-run` | Simulate counts |
| `--skip-existing` | Skip existing docs (default) |
| `--merge` | Update non-finalized records |
| `--remap-ids` | New ObjectIds + mapping report |

**Post-restore:** `verify:data-integrity`, `verify:snapshots`, `verify:audit-integrity`, `verify:restore`.

**Rollback:** abort failed transaction; do not `--merge` finalized grade sections; restore Mongo from pre-restore snapshot if needed.

---

## Disaster recovery (portable bundles)

| Tier | Scenario | Approach |
|------|----------|----------|
| Short | Single collection corruption | Partial section restore |
| Medium | DB lost, files intact | Full restore + upload sync |
| Long | Total loss | Full export from off-site archive |

**Procedure:**

1. Provision MongoDB + app host; set env per [architecture.md](./architecture.md)
2. `npm run verify:institution-export -- <batchId>` then `restoreInstitutionBundle.js --validate-only` then `--skip-existing`
3. Restore upload files to `UPLOADS_DIR` using `uploadsMetadata` section
4. `npm run verify:data-integrity`, `verify:snapshots`, `verify:audit-integrity`
5. Re-create secrets (JWT, SMTP) — not in exports

**Transcript check:** each `FINALIZED` lifecycle has matching `isCurrent` snapshots; `gradingPolicyHash` and `recordChecksum` valid.

---

## Corruption response

**Detect:**

```bash
npm run verify:data-integrity
npm run verify:snapshots
npm run verify:audit-integrity
```

| Signal | Severity | Action |
|--------|----------|--------|
| `export_hash_mismatch` | High | Do not restore; older archive |
| `snapshot_checksum_mismatch` | Critical | Freeze transcript issuance |
| `orphaned_submissions` | Medium | Repair or restore section |
| `missing_policy_snapshots` | High | Restore policy sections first |

**Steps:** contain (maintenance mode); snapshot (`export:institution`); diagnose; prefer section restore from good bundle; never edit frozen snapshot grades in place; verify again.

---

## Migration cutover

| Phase | Action |
|-------|--------|
| T-7d | Full export + off-site copy |
| T-3d | Restore to staging |
| T-1d | Freeze grade finalization |
| T-0 | Quiesce; final delta export |
| T+0 | Restore target; verification suite |
| T+1h | Smoke login, gradebook, transcript |

Keep source DB snapshot until T+48h sign-off. Finalized snapshots never silently overwritten (`--skip-existing`).

**Institutional cutover:** `verify:institution-ready` → freeze finalize → export/verify staging parity → deploy → enable workers → smoke copy/archive/preview.

---

## Course operations

**Archive / restore:** `operationalStatus` = `active` | `draft` | `archived`. `PATCH .../archive` blocks new uploads via `assertCourseOperational`; historical files remain downloadable.

**Course copy:** `POST /api/courses/:id/copy` — includes modules, pages, assignments, discussions, file attachments; excludes submissions, grades, transcripts. Pass `{ "async": true }` for `course.copy` job.

**Bulk / maintenance:** `POST /api/courses/bulk` → `course.bulk` job; file maintenance via `npm run worker:file-maintenance`.

---

## Background jobs

| Job | Purpose |
|-----|---------|
| `course.copy` | Large course duplication |
| `course.bulk` | Bulk publish/archive/due-date shift |
| `maintenance.files` | Orphan scan, stale temp, integrity summary |

Admin → Settings → Operations shows queues and file metrics.

---

## Upload platform

**Daily:**

```bash
npm run verify:upload-platform:final
npm run worker:blob-purge
```

**Scheduled:** blob purge (`worker:blob-purge:apply`), file maintenance (`worker:file-maintenance`).

**Recovery:** Admin → Settings → Operations → Recovery Center; preview restore before apply; legal hold blocks purge.

**Retention:** Admin → Settings → Storage (deleted blob/metadata, ZIP export TTL).

| Symptom | Action |
|---------|--------|
| `PENDING_QUARANTINE` | Investigate quarantine; manual blob copy |
| Preview corrupted | `POST /api/files/:id/preview/regenerate` |
| ZIP job stuck | Check async queue; re-queue |

**Pre-release:** `test:files:all`, `test:e2e`, `verify:upload-platform:final`, `verify:file-platform:institutional`.

---

## Assignment workflow

**Deploy order:** additive schema → dual-read backend → `migrate:assignment-group-ids:dry-run` → verify → migrate → `worker:timed-quiz-sweep` → frontend → verification suite.

**Rollback:** `rollback:assignment-workflow:dry-run` — metadata only; does not delete submissions/grades/files.

**Recovery:**

- Timed quiz outage: restart worker → `recover:timed-quizzes:dry-run` → apply
- Grade release mistake: `node scripts/ops/recoverGradeRelease.js --assignment <id> --hide|--release --apply`
- Gradebook overload: pagination, reduce `pageSize`, `bench:gradebook`

Do not log answers, feedback text, filenames, or student records in telemetry.

---

## Discussion operations

**Moderation:** `GET /api/threads/:threadId/moderation-log`; restore via `POST /api/replies/:replyId/restore`.

**Unread repair:**

```powershell
npm run verify:discussion-participation
npm run repair:discussion-read-state
```

**Counter rebuild:**

```powershell
npm run repair:discussion-counters:dry-run
npm run repair:discussion-counters
```

**Participation:**

```powershell
npm run repair:discussion-participation:dry-run
npm run repair:discussion-participation
```

**Integrity:** `verify:discussion-integrity`, `verify:group-discussion-integrity`, `verify:discussion-migration-closure`, `bench:discussion-large`.

Historical discussion rollout/certification checklists are in [archive/](./archive/).

---

## Large course readiness

- Frontend: `FileUploadList` paginates at 50; upload concurrency 2; lazy preview
- Backend: async gradebook export; bulk ops via `course.bulk`
- Validation: `npm run test:scale` / `perf:gradebook` with 1000+ enrollments in staging

---

## Workflow consistency

All upload surfaces use `FileAttachmentPanel` → `useFileUploadQueue` → `POST /api/upload` → domain APIs with secure file URLs. Surfaces: assignments, pages, syllabus, announcements, discussions, inbox.

Notifications: `institutionalNotification.service.js` templates for upload, export, lifecycle, safety events.
