const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const SupportImpersonationSession = require('../../models/supportImpersonationSession.model');
const academicAuditService = require('../academicAudit.service');

/**
 * Platform support impersonation (Canvas masquerade).
 * JWT carries actAs + impersonatorId; auth loads target user and stamps audit actor.
 */

async function startImpersonation({
  actor,
  targetUserId,
  rootAccountId,
  reason,
  ip,
  requestId,
}) {
  if (actor?.role !== 'platform_admin') {
    const err = new Error('Only platform_admin may impersonate');
    err.status = 403;
    throw err;
  }
  if (!reason || String(reason).trim().length < 5) {
    const err = new Error('A support reason (min 5 chars) is required');
    err.status = 400;
    throw err;
  }

  const target = await User.findById(targetUserId);
  if (!target) {
    const err = new Error('Target user not found');
    err.status = 404;
    throw err;
  }
  if (rootAccountId && target.rootAccountId && String(target.rootAccountId) !== String(rootAccountId)) {
    const err = new Error('Target user is not in the specified institution');
    err.status = 403;
    throw err;
  }

  const tenantId = rootAccountId || target.rootAccountId;
  await SupportImpersonationSession.updateMany(
    { actorId: actor._id, isActive: true },
    { $set: { isActive: false, endedAt: new Date() } }
  );

  const session = await SupportImpersonationSession.create({
    actorId: actor._id,
    targetUserId: target._id,
    rootAccountId: tenantId,
    accountId: tenantId,
    reason: String(reason).trim(),
    ip: ip || '',
    requestId: requestId || '',
    isActive: true,
  });

  await academicAuditService.recordAuditEvent({
    actorId: actor._id,
    entityType: 'support_impersonation',
    entityId: session._id,
    action: 'impersonation_started',
    severity: 'critical',
    ip,
    requestId,
    rootAccountId: tenantId,
    metadata: {
      targetUserId: String(target._id),
      reason: session.reason,
    },
  });

  const secret = process.env.JWT_SECRET;
  const expire = process.env.IMPERSONATION_JWT_EXPIRE || '1h';
  const token = jwt.sign(
    {
      id: target._id,
      role: target.role,
      email: target.email,
      tv: target.tokenVersion || 0,
      rid: tenantId ? String(tenantId) : undefined,
      impersonatorId: String(actor._id),
      impersonationSessionId: String(session._id),
    },
    secret,
    { expiresIn: expire }
  );

  return { session, token, target };
}

async function endImpersonation({ actor, sessionId, ip, requestId }) {
  const filter = {
    actorId: actor._id,
    isActive: true,
  };
  if (sessionId) filter._id = sessionId;

  const session = await SupportImpersonationSession.findOne(filter).sort({ startedAt: -1 });
  if (!session) {
    const err = new Error('No active impersonation session');
    err.status = 404;
    throw err;
  }
  session.isActive = false;
  session.endedAt = new Date();
  await session.save();

  await academicAuditService.recordAuditEvent({
    actorId: actor._id,
    entityType: 'support_impersonation',
    entityId: session._id,
    action: 'impersonation_ended',
    severity: 'info',
    ip,
    requestId,
    rootAccountId: session.rootAccountId,
    metadata: { targetUserId: String(session.targetUserId) },
  });

  return session;
}

module.exports = {
  startImpersonation,
  endImpersonation,
};
