/**
 * Stable planner item keys for dismiss/snooze persistence across derived feeds.
 */

function buildDerivedOverdueAssignmentKey(assignmentId) {
  return `derived:overdue:assignment:${String(assignmentId)}`;
}

function buildDerivedMissingAssignmentKey(assignmentId) {
  return `derived:missing:assignment:${String(assignmentId)}`;
}

function buildDerivedAssignmentKey(assignmentId) {
  return `derived:assignment:${String(assignmentId)}`;
}

function buildDerivedDiscussionKey(threadId) {
  return `derived:discussion:${String(threadId)}`;
}

function buildDerivedUngradedKey(assignmentId) {
  return `derived:ungraded:${String(assignmentId)}`;
}

function buildTodoDocumentKey(todoId) {
  return `todo:${String(todoId)}`;
}

function resolveItemKeyFromFeedItem(item = {}) {
  if (item.plannerItemKey) return String(item.plannerItemKey);

  if (item._id && (item.type === 'enrollment_request' || item.type === 'waitlist_promotion' || item.type === 'general')) {
    return buildTodoDocumentKey(item._id);
  }

  if (item.ungradedCount != null && (item.id || item._id)) {
    return buildDerivedUngradedKey(item.id || item._id);
  }

  const entityId = item._id || item.id;
  if (!entityId) return null;

  if (item.type === 'discussion' || item.itemType === 'Discussion') {
    return buildDerivedDiscussionKey(entityId);
  }

  if (item.type === 'assignment' || item.itemType === 'Assignment') {
    if (item.subType === 'overdue') return buildDerivedOverdueAssignmentKey(entityId);
    if (item.subType === 'missing') return buildDerivedMissingAssignmentKey(entityId);
    return buildDerivedAssignmentKey(entityId);
  }

  return `derived:item:${String(entityId)}`;
}

module.exports = {
  buildDerivedAssignmentKey,
  buildDerivedDiscussionKey,
  buildDerivedUngradedKey,
  buildDerivedOverdueAssignmentKey,
  buildDerivedMissingAssignmentKey,
  buildTodoDocumentKey,
  resolveItemKeyFromFeedItem,
};
