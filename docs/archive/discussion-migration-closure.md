# Discussion migration closure (Phase G)

This document closes the legacy **embedded `Thread.replies`** era in favor of the **`DiscussionReply`** collection as the system of record for modern APIs.

## Definitions

- **Collection-backed**: replies stored in `discussionreplies` with `threadId`, `legacyReplyId` optional.
- **Embedded legacy**: `threads.replies` array (Mongoose subdocuments).
- **Mixed state**: both embedded array non-empty and at least one collection reply for the same thread — must be resolved before prune.

## Verification

| Script | Purpose |
|--------|---------|
| `npm run verify:discussion-final-migration:strict` | Superset integrity: parity, counters, participation, moderation consistency, audit linkage, orphans, mixed state |
| `npm run verify:discussion-migration-closure` | Earlier closure checks (still valid for CI) |
| `npm run verify:discussion-integrity` | Course/module/group references and counter vs collection counts |
| `npm run verify:discussion-historical` | Sample oldest + archived courses for mixed embedded/collection patterns |

## Safe prune of embedded arrays

1. Run `verify:discussion-final-migration:strict` until **PASS** (no issues).
2. Run `npm run prune:discussion-embedded:dry-run` — reports `threadsWithEmbeddedArrays`.
3. Run `npm run prune:discussion-embedded` — clears `replies` arrays where filter matches (non-deleted threads with embedded data).
4. If verification cannot pass but leadership accepts risk, `prune:discussion-embedded:force` skips the strict pre-check (requires written sign-off).

## Historical data validation

- **Oldest courses**: included in `verify:discussion-historical` sampling (`DISCUSSION_HISTORICAL_SAMPLE` env, default 15).
- **Archived courses**: `status: 'archived'` in course model.
- **Copied courses**: rely on same integrity checks post-copy; re-run final migration verify after bulk copy jobs.
- **Large migrated threads**: `discussionIntegrityDashboard` flags counter drift and oversized embedded arrays.
- **Legacy graded discussions**: grade visibility policy tests in Jest; final verifier checks `isGraded` threads still reference valid courses.

## Rollback after partial migration / prune

See `npm run discussion:rollback-playbook` for JSON scenarios. **Primary rollback** is always **restore Mongo from backup** taken at known-good checkpoints:

- Checkpoint A: before first `migrate:discussion-replies --apply`
- Checkpoint B: before `prune:discussion-embedded`

## Repair after interrupted migration

Typical order:

1. `repair:discussion-orphan-replies` (soft-delete replies with missing/deleted threads)
2. `repair:discussion-moderation` — normalize hidden flags
3. `repair:discussion-participation-dupes` — remove duplicate participation keys (pre-index era)
4. `repair:discussion-counters` — recompute from collection
5. `repair:discussion-participation` — replay participation from replies

All support dry-run by default; add `--apply` only after reviewing JSON output. Each script includes `rollbackGuidance` in its report.

## Certification gate

Phase G is **certified** for an environment when:

- `verify:discussion-final-migration:strict` exits 0
- `verify:discussion-operational-readiness` exits 0 (or warnings only where documented as acceptable)
- Prune (if applicable) completed with post-prune smoke tests passed
