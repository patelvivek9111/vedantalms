#!/usr/bin/env node
/**
 * Institutional rollback / recovery playbook (no DB writes).
 * Pair with docs/operations/discussion-migration-closure.md.
 */
const playbook = {
  generatedAt: new Date().toISOString(),
  scenarios: [
    {
      name: 'partial_migration_before_prune',
      detection: 'verify-discussion-migration-closure.js reports legacy_reply_missing_collection_copy',
      safeActions: [
        'Run migrate:discussion-replies:dry-run then migrate:discussion-replies with --apply (no --prune-embedded).',
        'Run repair:discussion-counters:dry-run then repair:discussion-counters --apply.',
      ],
      rollback: [
        'Restore Mongo from snapshot taken before --apply.',
        'If only new replies inserted with legacyReplyId set, delete those DiscussionReply docs by query filter legacyReplyId exists and createdAt >= migration window (expert review).',
      ],
    },
    {
      name: 'after_prune_wrong',
      detection: 'Threads missing embedded arrays but UI still expects legacy-only data path',
      rollback: [
        'Restore threads collection from backup predating prune.',
        'DiscussionReply collection remains authoritative for modern code paths.',
      ],
    },
    {
      name: 'interrupted_migration',
      detection: 'Mixed embedded + collection counts or counter mismatch',
      safeActions: [
        'node scripts/ops/rebuild-discussion-counters.js --apply',
        'node scripts/ops/recalculate-discussion-participation.js --apply',
        'node scripts/ops/repair-discussion-moderation-transitions.js --apply',
      ],
    },
    {
      name: 'integrity_failure_counters',
      detection: 'discussionIntegrityDashboard or verify-discussion-integrity fails counter check',
      safeActions: ['node scripts/ops/rebuild-discussion-counters.js --apply'],
    },
  ],
  emergencyDisable: [
    'Feature flags: set discussion maintenance banner in LMS UI config (if available).',
    'At API layer: temporarily deny POST /api/threads/*/replies in reverse proxy (last resort; breaks posting).',
  ],
};

console.log(JSON.stringify(playbook, null, 2));
