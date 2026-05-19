const SystemAuditEvent = require('../models/systemAuditEvent.model');

async function recordAuditEvent({
  actorId,
  entityType,
  entityId,
  action,
  before = null,
  after = null,
  severity = 'info',
  ip,
  requestId,
  metadata,
}) {
  return SystemAuditEvent.create({
    actor: actorId,
    entityType,
    entityId: String(entityId),
    action,
    before,
    after,
    severity,
    ip,
    requestId,
    metadata,
  });
}

async function listAuditEvents(entityType, entityId, { limit = 50 } = {}) {
  return SystemAuditEvent.find({ entityType, entityId: String(entityId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'firstName lastName email role')
    .lean();
}

module.exports = {
  recordAuditEvent,
  listAuditEvents,
};
