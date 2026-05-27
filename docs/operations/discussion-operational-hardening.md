# Discussion operational hardening (Phase F)

Phase F adds **recovery tooling**, **structured observability**, **security regression coverage**, and **rollout documentation** without changing product features.

## Recovery tooling (dry-run default, `--apply` to write)

| Area | Script |
|------|--------|
| Corrupted / drift counters | `scripts/ops/rebuild-discussion-counters.js` |
| Orphaned participation & stale unread | `scripts/ops/repair-discussion-read-state.js` |
| Participation replay from replies | `scripts/ops/recalculate-discussion-participation.js` |
| Group partition auto-map | `scripts/ops/repair-group-discussion-partitions.js` |
| Orphaned replies (missing/deleted thread) | `scripts/ops/repair-orphaned-discussion-replies.js` |
| Failed / inconsistent moderation flags | `scripts/ops/repair-discussion-moderation-transitions.js` |
| Duplicate participation documents | `scripts/ops/repair-duplicate-discussion-participation.js` |
| Prune embedded replies (post-verification) | `scripts/ops/prune-embedded-discussion-replies.js` |

Shared CLI metadata: `scripts/lib/discussionRepairCli.js` — every report includes `mode`, `rollbackGuidance`, and script name.

**Partial migration rollback** is documented procedurally (not automated destructive rollback): `scripts/ops/audit-discussion-migration-rollback.js`.

## Observability

- **HTTP envelope**: `middleware/discussionRouteMetrics.js` mounted on `/api/threads` and `/api/replies` — emits `metric.discussion_route_latency` with anonymized paths (`ObjectId` → `:id`).
- **Domain events**: `services/discussionObservability.service.js` wraps `workflowObservability.service` for reply pagination, mark-read, large threads, reply failures, duplicate suppression, moderation, and hidden-grade surface requests.

Dashboard-style counts remain in `scripts/ops/discussionIntegrityDashboard.js` (`npm run support:discussion-dashboard`).

## Cache and invalidation

Discussion read/unread and counters are **database-backed** (not `workflowCache.service` keys). Hardening is validated by:

- Participation service tests (`markThreadRead` aligns `unreadCount` / `lastReadReplyCreatedAt` with latest reply).
- Reply create path updates counters and participation (`tests/discussions/discussionParticipation.test.js`, `discussionConcurrency.test.js`).
- Grade visibility policy tests (`discussionGradeVisibility.policy.test.js`).

## Security and abuse

- **HTML**: `tests/discussions/discussionSanitizer.server.test.js` (server-side sanitizer).
- **Access / enumeration**: existing `discussionAccess.policy.test.js`, `discussionGroupIsolation.test.js`.
- **Pagination abuse**: `discussionPagination.test.js` (limit capped at 100).
- **Concurrency / duplicate replies**: `discussionConcurrency.test.js`.

Rate limits and attachment edge cases remain covered by broader API / file tests; extend with supertest when adding new routes.

## Operational verification bundle

```bash
npm run verify:discussion-operational-readiness
```

Runs final migration strict check, integrity, indexes, optional group warnings, dashboard strict mode, all repair scripts in **dry-run**, historical sampling, and the rollback playbook emitter.

## Related documents

- `docs/operations/discussion-rollout-checklist.md`
- `docs/operations/discussion-migration-closure.md`
- `docs/operations/discussion-log-dashboard.md`
- `docs/operations/discussion-operations-runbook.md` (existing)
