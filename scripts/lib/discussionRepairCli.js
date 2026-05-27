'use strict';

/**
 * Standard metadata for discussion repair / ops scripts (Phase F).
 * All mutating scripts default to dry-run; pass --apply to write.
 */

const ROLLBACK_GUIDANCE = {
  general:
    'Take a Mongo backup (mongodump) before any --apply. Without a backup, rollback is restore-from-snapshot only.',
  counters:
    'rebuild-discussion-counters recomputes Thread.counters from DiscussionReply. If wrong, restore threads.counters from backup or re-run after fixing reply data.',
  embeddedPrune:
    'Prune clears Thread.replies arrays. Rollback: restore threads from backup; collection replies (discussionreplies) remain the source of truth.',
  participation:
    'Participation rows are derived operational state. Rollback: restore discussionparticipations from backup, then run recalculate-discussion-participation --apply.',
  moderation:
    'Moderation repair adjusts reply flags. Rollback: restore discussionreplies from backup for affected reply IDs.',
  orphanedReplies:
    'Soft-deleted orphaned replies can be restored by clearing deletedAt/deletedBy from backup for those documents.',
  duplicateParticipation:
    'Dedupe deletes extra participation documents. Rollback: restore discussionparticipations from backup.',
  readState:
    'read-state repair clamps counters and removes orphaned rows. Rollback: restore discussionparticipations from backup.',
  groupPartitions:
    'Sets Thread.groupId when unambiguous. If wrong group was chosen, restore threads from backup or set groupId manually.',
};

function parseRepairArgv(argv = process.argv) {
  return {
    apply: argv.includes('--apply'),
    strict: argv.includes('--strict'),
    /** Explicit dry-run flag (informational only; absence of --apply is still dry-run). */
    dryRunRequested: argv.includes('--dry-run'),
  };
}

function finishReport(base, rollbackKeys = ['general']) {
  const keys = rollbackKeys.length ? rollbackKeys : ['general'];
  return {
    ...base,
    mode: base.apply ? 'apply' : 'dry-run',
    rollbackGuidance: keys.map((key) => ({
      area: key,
      text: ROLLBACK_GUIDANCE[key] || ROLLBACK_GUIDANCE.general,
    })),
  };
}

module.exports = {
  ROLLBACK_GUIDANCE,
  parseRepairArgv,
  finishReport,
};
