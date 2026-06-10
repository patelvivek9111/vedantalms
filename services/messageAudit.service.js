const crypto = require('crypto');
const academicAudit = require('./academicAudit.service');

function isAuditEnabled() {
  return process.env.INBOX_AUDIT_ENABLED === 'true';
}

function auditReadEventsEnabled() {
  return process.env.INBOX_AUDIT_READ_EVENTS === 'true';
}

function normalizeId(value) {
  if (!value) return 'n/a';
  return String(value._id || value);
}

function requestMeta(req) {
  return {
    ip: req?.ip,
    requestId: req?.requestId || req?.auditCorrelationId,
    method: req?.method,
    path: req?.path,
    role: req?.user?.role,
  };
}

async function recordInboxEvent({
  req,
  action,
  entityType,
  entityId,
  severity = 'info',
  metadata = {},
}) {
  if (!isAuditEnabled() || !req?.user?._id) return null;
  return academicAudit
    .recordAuditEvent({
      actorId: req.user._id,
      entityType,
      entityId: normalizeId(entityId),
      action,
      severity,
      ...requestMeta(req),
      metadata: {
        ...metadata,
        subsystem: 'inbox',
      },
    })
    .catch(() => null);
}

async function recordConversationCreated(req, { conversationId, courseId, recipientCount, sendIndividually }) {
  return recordInboxEvent({
    req,
    action: 'inbox_conversation_created',
    entityType: 'conversation',
    entityId: conversationId,
    metadata: {
      courseId: courseId ? normalizeId(courseId) : null,
      recipientCount,
      sendIndividually: Boolean(sendIndividually),
    },
  });
}

async function recordMessageSent(req, { conversationId, messageId, attachmentCount = 0 }) {
  return recordInboxEvent({
    req,
    action: 'inbox_message_sent',
    entityType: 'message',
    entityId: messageId,
    metadata: {
      conversationId: normalizeId(conversationId),
      attachmentCount,
    },
  });
}

async function recordConversationRead(req, { conversationId }) {
  if (!auditReadEventsEnabled()) return null;
  return recordInboxEvent({
    req,
    action: 'inbox_conversation_read',
    entityType: 'conversation',
    entityId: conversationId,
    severity: 'info',
    metadata: {},
  });
}

async function recordAccessDenied(req, { conversationId, reason, code }) {
  return recordInboxEvent({
    req,
    action: 'inbox_access_denied',
    entityType: 'conversation',
    entityId: conversationId || req?.params?.conversationId,
    severity: 'warning',
    metadata: { reason, code },
  });
}

async function recordRateLimited(req, { limitType, path }) {
  return recordInboxEvent({
    req,
    action: 'inbox_rate_limited',
    entityType: 'inbox',
    entityId: limitType || 'unknown',
    severity: 'warning',
    metadata: { path: path || req?.path, limitType },
  });
}

async function recordSpamBlocked(req, { code, conversationId, metadata = {} }) {
  return recordInboxEvent({
    req,
    action: 'inbox_spam_blocked',
    entityType: 'conversation',
    entityId: conversationId || 'n/a',
    severity: 'warning',
    metadata: { code, ...metadata },
  });
}

function hashBodyPreview(bodyText = '') {
  return crypto.createHash('sha256').update(String(bodyText).trim().slice(0, 2000)).digest('hex').slice(0, 16);
}

module.exports = {
  isAuditEnabled,
  auditReadEventsEnabled,
  recordConversationCreated,
  recordMessageSent,
  recordConversationRead,
  recordAccessDenied,
  recordRateLimited,
  recordSpamBlocked,
  hashBodyPreview,
};
