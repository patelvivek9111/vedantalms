/**
 * ERP hold webhook — HMAC verification, apply, retry, dead-letter.
 */
const crypto = require('crypto');
const StudentHold = require('../../models/studentHold.model');
const User = require('../../models/user.model');
const ErpHoldWebhookEvent = require('../../models/erpHoldWebhookEvent.model');
const { withTenantFilter } = require('../../utils/tenantContext');
const academicAuditService = require('../academicAudit.service');

function getExpectedSecret() {
  return String(process.env.ERP_HOLDS_WEBHOOK_SECRET || '');
}

function requireSecretInProduction() {
  if (process.env.NODE_ENV === 'production' && !getExpectedSecret()) {
    return false;
  }
  return true;
}

/**
 * Verify inbound ERP webhook auth.
 * Preferred: X-Erp-Signature: sha256=<hmac_hex> over raw body (or JSON.stringify(body)).
 * Legacy: X-Webhook-Secret / X-Erp-Signature equal to shared secret (Phase R8).
 */
function verifyErpAuth(req) {
  const expected = getExpectedSecret();
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, method: 'invalid', reason: 'secret_not_configured' };
    }
    return { ok: true, method: 'none', reason: 'dev_open' };
  }

  const sigHeader = String(req.get('x-erp-signature') || '').trim();
  const secretHeader = String(req.get('x-webhook-secret') || req.body?.secret || '').trim();

  // HMAC path
  if (sigHeader.toLowerCase().startsWith('sha256=')) {
    const provided = sigHeader.slice(7).trim();
    const raw =
      req.rawBody != null
        ? Buffer.isBuffer(req.rawBody)
          ? req.rawBody
          : Buffer.from(String(req.rawBody))
        : Buffer.from(JSON.stringify(req.body || {}));
    const digest = crypto.createHmac('sha256', expected).update(raw).digest('hex');
    try {
      const a = Buffer.from(provided, 'hex');
      const b = Buffer.from(digest, 'hex');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return { ok: true, method: 'hmac' };
      }
    } catch {
      /* fall through */
    }
    return { ok: false, method: 'invalid', reason: 'hmac_mismatch' };
  }

  // Legacy shared-secret equality (header may be on x-erp-signature without sha256=)
  const provided = secretHeader || sigHeader;
  if (!provided) return { ok: false, method: 'invalid', reason: 'missing_secret' };
  try {
    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, method: 'shared_secret' };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, method: 'invalid', reason: 'secret_mismatch' };
}

async function resolveStudent(tenantId, payload) {
  const { studentId, studentEmail, sisId } = payload || {};
  if (studentId) {
    return User.findOne(withTenantFilter({ _id: studentId }, tenantId));
  }
  if (sisId) {
    return User.findOne(
      withTenantFilter({ 'studentProfile.externalIds.sis': String(sisId).trim() }, tenantId)
    );
  }
  if (studentEmail) {
    return User.findOne(
      withTenantFilter({ email: String(studentEmail).toLowerCase().trim() }, tenantId)
    );
  }
  return null;
}

async function applyHoldPayload(tenantId, payload) {
  const {
    externalHoldId,
    holdType = 'other',
    reason = 'ERP hold',
    active = true,
    blocksRegistration = true,
    blocksTranscript = false,
    blocksGrades = false,
  } = payload || {};

  if (!externalHoldId) {
    const err = new Error('externalHoldId is required');
    err.status = 400;
    throw err;
  }

  const student = await resolveStudent(tenantId, payload);
  if (!student) {
    const err = new Error('Student not found in tenant');
    err.status = 404;
    throw err;
  }

  let hold = await StudentHold.findOne(
    withTenantFilter({ externalHoldId: String(externalHoldId) }, tenantId)
  );

  if (!active) {
    if (hold) {
      hold.isActive = false;
      hold.releasedAt = new Date();
      await hold.save();
    }
    return { action: hold ? 'released' : 'noop', hold, student };
  }

  if (hold) {
    hold.holdType = holdType;
    hold.reason = reason;
    hold.blocksRegistration = Boolean(blocksRegistration);
    hold.blocksTranscript = Boolean(blocksTranscript);
    hold.blocksGrades = Boolean(blocksGrades);
    hold.isActive = true;
    hold.source = 'erp';
    await hold.save();
  } else {
    hold = await StudentHold.create({
      studentId: student._id,
      holdType,
      reason,
      blocksRegistration: Boolean(blocksRegistration),
      blocksTranscript: Boolean(blocksTranscript),
      blocksGrades: Boolean(blocksGrades),
      externalHoldId: String(externalHoldId),
      source: 'erp',
      placedBy: student._id,
      isActive: true,
      rootAccountId: tenantId,
      accountId: student.accountId || tenantId,
    });
  }

  await academicAuditService
    .recordAuditEvent({
      actorId: student._id,
      entityType: 'student_hold',
      entityId: hold._id,
      action: 'integrations.erp.hold_upserted',
      after: { externalHoldId, studentId: String(student._id), active: true },
      severity: 'info',
      rootAccountId: tenantId,
      metadata: { source: 'erp', externalHoldId },
    })
    .catch(() => {});

  return { action: 'upserted', hold, student };
}

async function ingestAndProcess({ tenantId, payload, auth }) {
  const maxAttempts = parseInt(process.env.ERP_HOLDS_MAX_ATTEMPTS || '5', 10);
  const event = await ErpHoldWebhookEvent.create({
    externalHoldId: String(payload?.externalHoldId || ''),
    payload,
    signatureValid: auth.ok,
    authMethod: auth.method,
    status: 'received',
    attempts: 0,
    maxAttempts,
    rootAccountId: tenantId,
    accountId: tenantId,
  });

  return processEvent(event);
}

async function processEvent(eventDoc) {
  const event =
    eventDoc.save != null ? eventDoc : await ErpHoldWebhookEvent.findById(eventDoc._id || eventDoc);
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }

  event.status = 'processing';
  event.attempts = (event.attempts || 0) + 1;
  await event.save();

  try {
    const result = await applyHoldPayload(event.rootAccountId, event.payload);
    event.status = 'applied';
    event.holdId = result.hold?._id || null;
    event.lastError = '';
    event.processedAt = new Date();
    event.nextRetryAt = null;
    await event.save();
    return {
      ok: true,
      event,
      action: result.action,
      hold: result.hold,
      httpStatus: result.action === 'upserted' ? 201 : 200,
    };
  } catch (err) {
    const max = event.maxAttempts || 5;
    event.lastError = err.message;
    if (event.attempts >= max) {
      event.status = 'dead_letter';
      event.nextRetryAt = null;
    } else {
      event.status = 'failed';
      const backoffMs = Math.min(60 * 60 * 1000, 1000 * 2 ** Math.min(event.attempts, 8));
      event.nextRetryAt = new Date(Date.now() + backoffMs);
    }
    await event.save();
    return {
      ok: false,
      event,
      error: err.message,
      statusCode: err.status || 500,
      deadLetter: event.status === 'dead_letter',
    };
  }
}

async function retryDueEvents({ limit = 50 } = {}) {
  const due = await ErpHoldWebhookEvent.find({
    status: 'failed',
    nextRetryAt: { $lte: new Date() },
  })
    .sort({ nextRetryAt: 1 })
    .limit(limit);

  const results = [];
  for (const ev of due) {
    results.push(await processEvent(ev));
  }
  return { processed: results.length, results };
}

async function listEvents(tenantId, { status, limit = 50 } = {}) {
  const filter = withTenantFilter({}, tenantId);
  if (status) filter.status = status;
  return ErpHoldWebhookEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();
}

async function replayEvent(tenantId, eventId) {
  const event = await ErpHoldWebhookEvent.findOne(withTenantFilter({ _id: eventId }, tenantId));
  if (!event) {
    const err = new Error('Event not found');
    err.status = 404;
    throw err;
  }
  event.status = 'failed';
  event.attempts = Math.max(0, (event.attempts || 1) - 1);
  event.nextRetryAt = new Date();
  await event.save();
  return processEvent(event);
}

function getErpHealth() {
  const secret = Boolean(getExpectedSecret());
  return {
    configured: secret,
    requireInProduction: process.env.NODE_ENV === 'production',
    productionOk: requireSecretInProduction(),
    maxAttempts: parseInt(process.env.ERP_HOLDS_MAX_ATTEMPTS || '5', 10),
    auth: 'HMAC-SHA256 (X-Erp-Signature: sha256=…) or legacy shared secret',
  };
}

module.exports = {
  verifyErpAuth,
  requireSecretInProduction,
  applyHoldPayload,
  ingestAndProcess,
  processEvent,
  retryDueEvents,
  listEvents,
  replayEvent,
  getErpHealth,
};
