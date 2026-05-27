/**
 * Server-side diagnostics for discussion list filtering (Phase 1).
 * Detailed per-thread fields only in non-production or when DISCUSSION_LIST_DIAGNOSTICS=1.
 * Summary metrics (denialCode + routeType only) always emitted for ops aggregation.
 */
const observability = require('./workflowObservability.service');
const discussionAccess = require('./discussionAccess.service');

function verboseFilteredLogsEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.DISCUSSION_LIST_DIAGNOSTICS === '1';
}

function canAttachVisibilityDebug(user, course) {
  if (!user || !course) return false;
  if (user.role === 'admin') return true;
  return discussionAccess.isCourseStaff(user, course);
}

function recordThreadFiltered({ routeType, thread, user, courseId, error }) {
  const denialCode = error?.code || 'UNKNOWN';
  observability.metric('discussion_list_filtered_threads_total', {
    denialCode,
    routeType,
  });
  if (!verboseFilteredLogsEnabled()) return;
  observability.metric('discussion_list_thread_filtered_verbose', {
    denialCode,
    routeType,
    threadId: thread?._id ? String(thread._id) : null,
    userId: user?._id ? String(user._id) : null,
    userRole: user?.role || null,
    courseId: courseId ? String(courseId) : null,
    moduleId: thread?.module ? String(thread.module) : null,
    groupSetId: thread?.groupSet ? String(thread.groupSet) : null,
    published: thread?.published,
    availableFrom: thread?.availableFrom || null,
    denialMessage: error?.message || null,
  });
}

module.exports = {
  canAttachVisibilityDebug,
  recordThreadFiltered,
  verboseFilteredLogsEnabled,
};
