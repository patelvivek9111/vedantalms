const { getEventContract } = require('./plannerNotificationContract');

/**
 * Cross-surface duplication suppression (enrollment, grading, announcements).
 * Returns whether notification/planner delivery should be skipped with a reason code.
 */

function normalizeRole(role) {
  if (!role) return null;
  return String(role).toLowerCase();
}

function normalizeId(value) {
  if (value == null) return null;
  return String(value._id || value);
}

function idsEqual(a, b) {
  if (a == null || b == null) return false;
  return normalizeId(a) === normalizeId(b);
}

/**
 * @param {object} intent
 * @param {string} intent.domainEvent
 * @param {string} [intent.recipientRole]
 * @param {string} [intent.notificationType]
 * @param {string} [intent.surfaceOverride] - force check ('notification'|'planner')
 */
function evaluateNotificationSuppression(intent = {}) {
  const contract = getEventContract(intent.domainEvent);

  if (!contract) {
    return { suppress: false, reason: null, contract: null };
  }

  if (!contract.deliversNotification) {
    return {
      suppress: true,
      reason: 'contract_notification_not_applicable',
      contract,
    };
  }

  const role = normalizeRole(intent.recipientRole);

  if (idsEqual(intent.recipientId, intent.actorId)) {
    const reason =
      intent.domainEvent === 'discussion.reply'
        ? 'discussion_reply_author'
        : 'self_notification';
    return {
      suppress: true,
      reason,
      contract,
    };
  }

  if (contract.plannerOwnerRoles?.length && role && contract.plannerOwnerRoles.includes(role)) {
    return {
      suppress: true,
      reason: 'planner_owner_role',
      contract,
    };
  }

  if (
    intent.domainEvent === 'enrollment.requested' &&
    (role === 'teacher' || role === 'admin')
  ) {
    return {
      suppress: true,
      reason: 'enrollment_instructor_uses_planner_todo',
      contract,
    };
  }

  if (
    intent.domainEvent === 'submission.graded' &&
    intent.notificationType &&
    intent.notificationType !== 'assignment_graded' &&
    intent.notificationType !== 'grade'
  ) {
    return {
      suppress: true,
      reason: 'grading_notification_type_mismatch',
      contract,
    };
  }

  if (
    intent.domainEvent === 'announcement.created' &&
    intent.notificationType &&
    intent.notificationType !== 'announcement'
  ) {
    return {
      suppress: true,
      reason: 'announcement_notification_type_mismatch',
      contract,
    };
  }

  return { suppress: false, reason: null, contract };
}

function evaluatePlannerSuppression(intent = {}) {
  const contract = getEventContract(intent.domainEvent);

  if (!contract) {
    return { suppress: false, reason: null, contract: null };
  }

  if (!contract.deliversPlannerEntry) {
    return {
      suppress: true,
      reason: 'contract_planner_not_applicable',
      contract,
    };
  }

  const role = normalizeRole(intent.recipientRole);

  if (role === 'student' && contract.plannerTodoType === 'enrollment_request') {
    return {
      suppress: true,
      reason: 'enrollment_request_instructor_only',
      contract,
    };
  }

  const informationalNoPlanner = new Set([
    'announcement.created',
    'submission.created',
    'submission.graded',
    'inbox.message',
    'assignment.created',
    'assignment.updated',
    'assignment.published',
    'discussion.created',
    'discussion.reply',
    'discussion.graded',
    'course.published',
    'course.unpublished',
    'grades.posted',
    'grades.finalized',
    'grades.amended',
  ]);

  if (informationalNoPlanner.has(intent.domainEvent)) {
    return {
      suppress: true,
      reason: 'informational_event_no_planner_row',
      contract,
    };
  }

  return { suppress: false, reason: null, contract };
}

function shouldDeliverNotification(intent) {
  const result = evaluateNotificationSuppression(intent);
  return !result.suppress;
}

function shouldSurfacePlannerEntry(intent) {
  const result = evaluatePlannerSuppression(intent);
  return !result.suppress;
}

module.exports = {
  evaluateNotificationSuppression,
  evaluatePlannerSuppression,
  shouldDeliverNotification,
  shouldSurfacePlannerEntry,
};
