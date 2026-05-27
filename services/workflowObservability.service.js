function safeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function requestLabels(req = {}) {
  return {
    requestId: req.requestId || req.auditCorrelationId || null,
    route: req.originalUrl ? String(req.originalUrl).split('?')[0] : null,
    method: req.method || null,
    actorRole: req.user?.role || null,
    actorId: safeId(req.user),
  };
}

function sanitizeFields(fields = {}) {
  const blocked = new Set(['answers', 'feedback', 'submissionText', 'files', 'fileAssets', 'uploadedFiles']);
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => !blocked.has(key))
  );
}

function emitWorkflowEvent(event, fields = {}) {
  const payload = {
    event,
    at: new Date().toISOString(),
    ...sanitizeFields(fields),
  };
  // Keep logs structured and avoid answers, filenames, feedback, or grade details.
  try {
    console.info(JSON.stringify(payload));
  } catch (error) {
    console.info(JSON.stringify({
      event: 'workflow_observability_serialize_failed',
      at: new Date().toISOString(),
      originalEvent: event,
      error: error.message,
    }));
  }
}

function metric(name, fields = {}) {
  emitWorkflowEvent(`metric.${name}`, fields);
}

module.exports = {
  safeId,
  requestLabels,
  emitWorkflowEvent,
  metric,
};
