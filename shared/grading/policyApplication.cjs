/**
 * Per-assignment policy resolution (prospective_only + from_assignment apply modes).
 */
const { resolvedPolicyFromSnapshot } = require('./policySnapshot.cjs');

const VALID_APPLY_MODES = new Set(['retroactive_all', 'prospective_only', 'from_assignment']);

function normalizeApplyMode(mode) {
  if (mode && VALID_APPLY_MODES.has(mode)) return mode;
  return 'retroactive_all';
}

function buildPolicyApplication(coursePolicy = null, overrides = {}) {
  const applyMode = normalizeApplyMode(overrides.applyMode ?? coursePolicy?.applyMode);
  const effectiveAt =
    overrides.effectiveAt !== undefined
      ? overrides.effectiveAt
      : coursePolicy?.effectiveAt ?? null;
  const effectiveAssignmentId =
    overrides.effectiveAssignmentId !== undefined
      ? overrides.effectiveAssignmentId
      : coursePolicy?.effectiveAssignmentId ?? null;
  const legacyPolicy =
    applyMode === 'retroactive_all'
      ? null
      : overrides.legacyPolicy ??
        (coursePolicy?.legacyPolicySnapshot
          ? stripPolicyApplication(resolvedPolicyFromSnapshot(coursePolicy.legacyPolicySnapshot))
          : null);

  return {
    applyMode,
    effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : null,
    effectiveAssignmentId: effectiveAssignmentId ? String(effectiveAssignmentId) : null,
    assignmentOrder: overrides.assignmentOrder ?? null,
    legacyPolicy,
  };
}

function getAssignmentGradedAt(submission, assignment) {
  if (submission?.gradedAt) return new Date(submission.gradedAt);
  if (assignment?.gradedAt) return new Date(assignment.gradedAt);
  if (typeof assignment?.grade === 'number' || assignment?.grade === 'excused') {
    return assignment?.updatedAt ? new Date(assignment.updatedAt) : null;
  }
  return null;
}

function stripPolicyApplication(resolved) {
  if (!resolved || typeof resolved !== 'object') return resolved;
  const { policyApplication, ...rest } = resolved;
  return rest;
}

function assignmentIsBeforeCutoff(app, assignmentId) {
  if (!app?.effectiveAssignmentId || !app?.assignmentOrder?.length) return false;
  const idx = app.assignmentOrder.indexOf(String(assignmentId));
  const cutoffIdx = app.assignmentOrder.indexOf(String(app.effectiveAssignmentId));
  if (idx < 0 || cutoffIdx < 0) return false;
  return idx < cutoffIdx;
}

function usesLegacyPolicyRules(app, submission, assignment, gradeMode) {
  if (gradeMode !== 'current' || !app) return false;
  const mode = app.applyMode || 'retroactive_all';
  if (mode === 'retroactive_all') return false;

  if (mode === 'from_assignment') {
    return assignmentIsBeforeCutoff(app, assignment?._id);
  }

  if (mode === 'prospective_only' && app.effectiveAt) {
    const gradedAt = getAssignmentGradedAt(submission, assignment);
    if (!gradedAt) return false;
    return gradedAt < new Date(app.effectiveAt);
  }

  return false;
}

function applyLegacyPolicyLayer(live, app, submission) {
  const snapshot = submission?.gradingPolicySnapshot;
  const fromSnapshot = snapshot ? resolvedPolicyFromSnapshot(snapshot) : null;
  if (fromSnapshot) {
    return {
      ...fromSnapshot,
      groups: live.groups,
      gradeScale: live.gradeScale,
      policyApplication: app,
    };
  }
  if (app.legacyPolicy) {
    return {
      ...app.legacyPolicy,
      groups: live.groups,
      gradeScale: live.gradeScale,
      policyApplication: app,
    };
  }
  return live;
}

/**
 * Resolve which policy rules apply to a single assignment contribution.
 * Group weights / grade scale always come from the live resolved policy.
 */
function resolveEffectivePolicyForAssignment(resolved, submission, assignment, gradeMode = 'current') {
  const live = resolved || {};
  const app = live.policyApplication;

  if (!usesLegacyPolicyRules(app, submission, assignment, gradeMode)) {
    return live;
  }

  return applyLegacyPolicyLayer(live, app, submission);
}

function structuralPolicyPayload(payload = {}) {
  return Boolean(payload.groups || payload.gradeScale);
}

function enrichResolvedForAssignmentOrder(resolved, assignments = []) {
  if (!resolved?.policyApplication || resolved.policyApplication.applyMode !== 'from_assignment') {
    return resolved;
  }
  return {
    ...resolved,
    policyApplication: {
      ...resolved.policyApplication,
      assignmentOrder: assignments.map((a) => String(a._id)),
    },
  };
}

function buildPreviewPolicyApplication({
  applyMode,
  currentResolved,
  effectiveAt,
  effectiveAssignmentId,
  assignmentOrder,
}) {
  const mode = normalizeApplyMode(applyMode);
  if (mode === 'retroactive_all') {
    return {
      applyMode: 'retroactive_all',
      effectiveAt: null,
      effectiveAssignmentId: null,
      assignmentOrder: null,
      legacyPolicy: null,
    };
  }
  if (mode === 'from_assignment') {
    return {
      applyMode: 'from_assignment',
      effectiveAt: null,
      effectiveAssignmentId: effectiveAssignmentId ? String(effectiveAssignmentId) : null,
      assignmentOrder: assignmentOrder || [],
      legacyPolicy: stripPolicyApplication(currentResolved),
    };
  }
  const cutoff = effectiveAt ? new Date(effectiveAt) : new Date();
  return {
    applyMode: 'prospective_only',
    effectiveAt: cutoff.toISOString(),
    effectiveAssignmentId: null,
    assignmentOrder: null,
    legacyPolicy: stripPolicyApplication(currentResolved),
  };
}

module.exports = {
  VALID_APPLY_MODES,
  normalizeApplyMode,
  buildPolicyApplication,
  getAssignmentGradedAt,
  stripPolicyApplication,
  assignmentIsBeforeCutoff,
  usesLegacyPolicyRules,
  resolveEffectivePolicyForAssignment,
  structuralPolicyPayload,
  enrichResolvedForAssignmentOrder,
  buildPreviewPolicyApplication,
};
