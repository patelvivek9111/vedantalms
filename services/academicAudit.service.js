const SystemAuditEvent = require('../models/systemAuditEvent.model');
const { getTenantRootAccountId } = require('../utils/tenantContext');

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
  rootAccountId,
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
    rootAccountId: rootAccountId || getTenantRootAccountId() || undefined,
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
