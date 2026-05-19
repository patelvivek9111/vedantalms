const academicAuditService = require('./academicAudit.service');

const SUSPICIOUS_ACTIONS = new Set([
  'ferpa_access_denied',
  'ferpa_cross_student_attempt',
  'ferpa_cross_course_attempt',
  'ferpa_privilege_escalation',
  'ferpa_suspicious_access',
]);

async function recordFerpaEvent({
  actorId,
  action,
  entityType,
  entityId,
  severity = 'warning',
  ip,
  requestId,
  metadata,
}) {
  const sev = SUSPICIOUS_ACTIONS.has(action) ? severity || 'critical' : severity;
  return academicAuditService.recordAuditEvent({
    actorId,
    entityType: entityType || 'ferpa',
    entityId: entityId || 'n/a',
    action,
    severity: sev,
    ip,
    requestId,
    metadata,
  });
}

async function recordAccessDenied(req, details = {}) {
  return recordFerpaEvent({
    actorId: req.user?._id,
    action: 'ferpa_access_denied',
    entityType: details.entityType || 'resource',
    entityId: details.entityId || req.path,
    severity: 'critical',
    ip: req.ip,
    requestId: req.requestId || req.auditCorrelationId,
    metadata: {
      method: req.method,
      path: req.path,
      role: req.user?.role,
      reason: details.reason,
      ...details.metadata,
    },
  });
}

async function recordTranscriptAccess(req, { studentId, term, year, mode = 'view' }) {
  return recordFerpaEvent({
    actorId: req.user._id,
    action: mode === 'download' ? 'transcript_download' : 'transcript_view',
    entityType: 'transcript',
    entityId: `${studentId}:${term}:${year}`,
    severity: 'info',
    ip: req.ip,
    requestId: req.requestId,
    metadata: { studentId: String(studentId), term, year, mode },
  });
}

async function recordExportRequest(req, { courseId, jobId, type }) {
  return recordFerpaEvent({
    actorId: req.user._id,
    action: 'gradebook_export_requested',
    entityType: 'course',
    entityId: String(courseId),
    severity: 'info',
    ip: req.ip,
    requestId: req.requestId,
    metadata: { jobId: jobId ? String(jobId) : null, exportType: type || 'gradebook' },
  });
}

async function recordExportDownload(req, { jobId, courseId }) {
  return recordFerpaEvent({
    actorId: req.user._id,
    action: 'gradebook_export_download',
    entityType: 'async_job',
    entityId: String(jobId),
    severity: 'info',
    ip: req.ip,
    requestId: req.requestId,
    metadata: { courseId: courseId ? String(courseId) : null },
  });
}

async function recordAdminOverride(req, details) {
  return recordFerpaEvent({
    actorId: req.user._id,
    action: 'admin_override',
    entityType: details.entityType || 'resource',
    entityId: details.entityId || req.path,
    severity: 'critical',
    ip: req.ip,
    requestId: req.requestId,
    metadata: details,
  });
}

module.exports = {
  recordFerpaEvent,
  recordAccessDenied,
  recordTranscriptAccess,
  recordExportRequest,
  recordExportDownload,
  recordAdminOverride,
};
