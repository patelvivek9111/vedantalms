const GradingPolicyAudit = require('../models/gradingPolicyAudit.model');
const {
  hashResolvedPolicy,
  toPlainPolicy,
} = require('../shared/grading/policySnapshot.cjs');
const { diffPolicies, summarizePolicyDiff } = require('../shared/grading/policyDiff.cjs');

async function recordPolicyChange({
  actorId,
  entityType,
  entityId,
  oldPolicy,
  newPolicy,
  reason,
}) {
  const oldPlain = toPlainPolicy(oldPolicy || {});
  const newPlain = toPlainPolicy(newPolicy || {});
  const diff = diffPolicies(oldPlain, newPlain);

  const entry = await GradingPolicyAudit.create({
    actor: actorId,
    entityType,
    entityId: String(entityId),
    oldPolicy: oldPlain,
    newPolicy: newPlain,
    oldHash: hashResolvedPolicy(oldPlain),
    newHash: hashResolvedPolicy(newPlain),
    diffSummary: {
      ...diff,
      summaryLines: summarizePolicyDiff(diff),
    },
    reason: reason || undefined,
  });

  return entry.toObject();
}

async function listAuditHistory(entityType, entityId, { limit = 50 } = {}) {
  return GradingPolicyAudit.find({ entityType, entityId: String(entityId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'firstName lastName email role')
    .lean();
}

module.exports = {
  recordPolicyChange,
  listAuditHistory,
};
