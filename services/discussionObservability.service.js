const observability = require('./workflowObservability.service');

function routeLatency(fields) {
  observability.metric('discussion_route_latency', fields);
}

function replyPageTiming(fields) {
  observability.metric('discussion_reply_pagination_timing', fields);
}

function markReadTiming(fields) {
  observability.metric('discussion_mark_read_timing', fields);
}

function largeThreadAccess(fields) {
  observability.metric('discussion_large_thread_access', fields);
}

function replyCreateFailed(fields) {
  observability.metric('discussion_reply_create_failed', fields);
}

function replyDuplicateSuppressed(fields) {
  observability.metric('discussion_reply_duplicate_suppressed', fields);
}

function moderationAction(fields) {
  observability.metric('discussion_moderation_action', fields);
}

/** Student explicitly requested grades while release rules keep them hidden (surface / API intent). */
function hiddenGradeSurfaceRequest(fields) {
  observability.metric('discussion_hidden_grade_surface_request', fields);
}

module.exports = {
  routeLatency,
  replyPageTiming,
  markReadTiming,
  largeThreadAccess,
  replyCreateFailed,
  replyDuplicateSuppressed,
  moderationAction,
  hiddenGradeSurfaceRequest,
};
