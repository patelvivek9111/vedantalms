# Discussion subsystem — production rollout checklist (Phase F)

Use this checklist when enabling or upgrading the collection-backed discussion stack across environments. No new product features are introduced here; this is operational sequencing only.

## Preconditions

- [ ] Mongo backup (`mongodump`) and restore drill documented for the target cluster.
- [ ] `MONGODB_URI` / `MONGODB_DB` verified for the environment.
- [ ] Application version pinned; frontend and backend deployed from the same release tag.

## Migration sequence (recommended order)

1. [ ] **Indexes**: `npm run verify:discussion-indexes` — ensure discussion/thread/reply indexes exist before load.
2. [ ] **Backfill replies** (if legacy embedded data remains):  
   - Dry-run: `npm run migrate:discussion-replies:dry-run`  
   - Apply: `npm run migrate:discussion-replies`  
   - Do **not** pass `--prune-embedded` until final verification passes.
3. [ ] **Counters**: `npm run repair:discussion-counters:dry-run` → `npm run repair:discussion-counters` (`--apply` via script).
4. [ ] **Participation**: `npm run repair:discussion-participation:dry-run` → `npm run repair:discussion-participation`.
5. [ ] **Read state / negative counts**: `npm run repair:discussion-read-state` (dry-run) → add `--apply` if issues reported.
6. [ ] **Group partitions** (if group discussions in scope): `npm run repair:group-discussion-partitions:dry-run` → `--apply` when `manualRequired` is zero or rows manually fixed.
7. [ ] **Integrity**: `npm run verify:discussion-integrity` and `npm run verify:discussion-final-migration:strict`.
8. [ ] **Prune embedded** (only after strict final migration passes): `npm run prune:discussion-embedded:dry-run` → `npm run prune:discussion-embedded`. Use `prune:discussion-embedded:force` only after written risk acceptance.

## Rollback sequence

- [ ] **Before prune**: restore Mongo snapshot taken immediately before `migrate:discussion-replies --apply` if reply data is wrong.
- [ ] **After prune**: restore `threads` collection (or full DB) from snapshot; `discussionreplies` remains authoritative for modern paths.
- [ ] **Playbook JSON**: `npm run discussion:rollback-playbook` for scenario text (no DB writes).

## Monitoring expectations

- Structured JSON logs on stdout for metrics (see `docs/operations/discussion-log-dashboard.md`):
  - `metric.discussion_route_latency` — `/api/threads`, `/api/replies`
  - `metric.discussion_reply_pagination_timing` — root and child reply pages
  - `metric.discussion_mark_read_timing` — mark-read
  - `metric.discussion_large_thread_access` — threads with ≥500 root replies (pagination path)
  - `metric.discussion_reply_create_failed` / `metric.discussion_reply_duplicate_suppressed`
  - `metric.discussion_moderation_action` — hide/restore
  - `metric.discussion_hidden_grade_surface_request` — student `includeGrades=true` while grades hidden
  - Existing: `metric.discussion_access_denied`, `metric.discussion_hidden_grade_payload_block`, etc.

## Alert thresholds (starting points; tune per institution)

| Signal | Suggested condition | Action |
|--------|----------------------|--------|
| Reply create failures | Spike in `discussion_reply_create_failed` with 5xx | Check Mongo, app errors, payload size |
| Access denied rate | Sustained `discussion_access_denied` vs baseline | Possible misconfiguration or abuse |
| Mark-read latency p95 | `discussion_mark_read_timing.durationMs` > 2s | Index / load on `discussionparticipations` |
| Route latency p95 | `discussion_route_latency.durationMs` > 3s on hot paths | Scale API, investigate N+1 |
| Final migration verify | `verify:discussion-final-migration:strict` non-zero exit | Block prune; run repair scripts |

## Smoke tests (post-deploy)

- [ ] Open course discussions list as student, instructor, TA.
- [ ] Post reply, nested reply, mark read, refresh unread badge.
- [ ] Moderation hide/restore as instructor; confirm student view redacts content.
- [ ] Graded discussion: hidden vs released grade visibility for student.
- [ ] Group discussion: non-member blocked.

## Staged rollout guidance

- [ ] Run full suite in staging: `npm run verify:discussion-operational-readiness`.
- [ ] Enable for a **pilot course**; monitor logs for 24–48h.
- [ ] Expand to college/department, then institution-wide.

## Emergency disable procedures

- Freeze writes: maintenance page or reverse-proxy block on `POST`/`PATCH`/`DELETE` under `/api/threads` and `/api/replies` (last resort).
- Restore read-only: serve static health while restoring DB from snapshot.
- Communicate: use institutional status channel; reference `discussion:rollback-playbook` scenarios.
