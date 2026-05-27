# Discussion Operations Runbook

Phase F/G references: [Operational hardening](./discussion-operational-hardening.md) · [Migration closure](./discussion-migration-closure.md) · [Rollout checklist](./discussion-rollout-checklist.md) · [Log metrics](./discussion-log-dashboard.md)

## Moderation Recovery

Use `GET /api/threads/:threadId/moderation-log` to inspect actions. Restore hidden or deleted replies through `POST /api/replies/:replyId/restore`. If restore fails because the reply is missing, run `npm run verify:discussion-migration-closure` to check orphaned reply chains before manual intervention.

## Unread Repair

Run:

```powershell
npm run verify:discussion-participation
npm run repair:discussion-read-state
```

This clamps invalid negative counters. It does not synthesize user visits; if a user never opened a thread, their read state may remain absent until first view.

## Counter Rebuild

Run dry-run first:

```powershell
npm run repair:discussion-counters:dry-run
npm run repair:discussion-counters
```

Counter rebuild uses collection-backed `DiscussionReply` rows as canonical. Do not use it to validate legacy embedded-only threads before migration.

## Participation Recalculation

Run:

```powershell
npm run repair:discussion-participation:dry-run
npm run repair:discussion-participation
```

Historical deleted replies still count as historical participation. This script is for consistency recovery, not grade policy changes.

## Reply Migration Rollback

If migration fails before pruning, leave embedded replies intact and delete collection rows for the affected threads from a database snapshot or targeted administrative repair. If pruning already happened, restore the database snapshot before retrying.

## Restoring Hidden Replies

Use `POST /api/replies/:replyId/restore`. Confirm with:

```powershell
npm run support:discussion-dashboard
```

Then inspect the thread as a student to confirm hidden content is not leaked before restore and is visible after restore.

## Orphaned Participation

Run:

```powershell
npm run verify:discussion-migration-closure
npm run repair:discussion-participation
```

If orphaned rows persist, confirm the thread was not intentionally deleted. Preserve deleted-thread audit rows.

## Group Membership Correction

Run:

```powershell
npm run verify:group-discussion-integrity
```

Group visibility follows current membership. Historical authored replies remain in the scoped discussion partition; do not move replies between groups without institutional approval.

## Large-Thread Degradation

If thread loads degrade:

1. Confirm UI is using root pagination and child lazy loading.
2. Run `npm run bench:discussion-large -- --apply` in a staging copy.
3. Run `npm run support:discussion-dashboard`.
4. Rebuild counters only after confirming collection reply counts are correct.
5. Do not re-enable embedded reply hydration.
