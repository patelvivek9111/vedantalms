const mongoose = require('mongoose');
const { createNotificationFromDomainEvent } = require('../domain/createNotificationFromDomainEvent');
const { prefetchNotificationRecipients } = require('./notificationCreate.service');
const { resolveActiveCourseStudentIds } = require('./courseEnrollmentRecipients.service');
const { evaluateNotificationSuppression } = require('../domain/duplicationPolicy.service');
const observability = require('../workflowObservability.service');

const DEFAULT_FANOUT_CONCURRENCY = 10;

function isAcademicNotificationExpansionEnabled() {
  return process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED === 'true';
}

function isPlannerMissingAssignmentsEnabled() {
  return process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED === 'true';
}

function normalizeObjectIdString(value) {
  if (value == null) return null;
  const id = value._id || value;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return String(id);
}

function resolveFanoutConcurrency() {
  const raw = process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY;
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_FANOUT_CONCURRENCY;
  }

  const parsed = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FANOUT_CONCURRENCY;
  }

  return parsed;
}

/**
 * Stable dedupe window for Phase 11A academic fanout notifications.
 */
function buildAcademicEventWindow({
  domainEvent,
  relatedId,
  recipientId,
  actorId,
  suffix,
} = {}) {
  const parts = [domainEvent || 'unknown'];
  parts.push(relatedId != null ? String(relatedId) : 'default');
  if (recipientId != null) parts.push(String(recipientId));
  if (actorId != null) parts.push(String(actorId));
  if (suffix) parts.push(String(suffix));
  return parts.join(':');
}

function excludeActorFromRecipients(recipientIds = [], actorId) {
  if (!Array.isArray(recipientIds)) return [];
  if (actorId == null) return recipientIds.map(normalizeObjectIdString).filter(Boolean);
  const actorStr = normalizeObjectIdString(actorId);
  return recipientIds
    .map(normalizeObjectIdString)
    .filter((id) => id && id !== actorStr);
}

function uniqueRecipientIds(recipientIds = []) {
  return [...new Set(excludeActorFromRecipients(recipientIds))];
}

async function resolveCourseStudentIds(courseOrCourseId) {
  return resolveActiveCourseStudentIds(courseOrCourseId);
}

async function runWithConcurrencyLimit(items, limit, worker) {
  if (!items.length) return [];

  const concurrency = Math.max(1, Math.min(limit, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}

async function deliverNotificationToRecipient({
  domainEvent,
  recipientId,
  actorId,
  relatedId,
  relatedType,
  requestId,
  buildContextForRecipient,
  prefetchCache = null,
}) {
  const context = buildContextForRecipient(recipientId) || {};
  const notificationType = context.notificationType || null;

  const suppression = evaluateNotificationSuppression({
    domainEvent,
    recipientRole: context.recipientRole,
    notificationType,
    recipientId,
    actorId,
  });

  if (suppression.suppress) {
    return 'suppressed';
  }

  const eventWindow =
    context.eventWindow ||
    buildAcademicEventWindow({
      domainEvent,
      relatedId: context.relatedId ?? relatedId,
      recipientId,
      actorId,
      suffix: context.eventWindowSuffix,
    });

  const notification = await createNotificationFromDomainEvent(domainEvent, {
    userId: recipientId,
    recipientRole: context.recipientRole,
    title: context.title,
    message: context.message,
    link: context.link,
    relatedId: context.relatedId ?? relatedId,
    relatedType: context.relatedType ?? relatedType,
    priority: context.priority,
    actorId,
    courseId: context.courseId,
    assignmentId: context.assignmentId,
    requestId,
    eventWindow,
    notificationType,
    prefetchCache,
  });

  return notification ? 'delivered' : 'skipped';
}

/**
 * Fan out with concurrency limit — always runs (announcements, legacy paths).
 */
async function fanoutBoundedDomainNotifications({
  domainEvent,
  recipientIds = [],
  actorId = null,
  relatedId = null,
  relatedType = null,
  requestId = null,
  buildContextForRecipient,
}) {
  return fanoutDomainNotificationsInternal({
    domainEvent,
    recipientIds,
    actorId,
    relatedId,
    relatedType,
    requestId,
    buildContextForRecipient,
    metricName: 'bounded_notification_fanout_completed',
    requireExpansionFlag: false,
  });
}

/**
 * Fan out a PR-8 domain event to multiple recipients via createNotificationFromDomainEvent.
 * No-op when ACADEMIC_NOTIFICATION_EXPANSION_ENABLED is false.
 */
async function fanoutAcademicDomainNotifications(params) {
  return fanoutDomainNotificationsInternal({
    ...params,
    metricName: 'academic_notification_fanout_completed',
    requireExpansionFlag: true,
  });
}

async function fanoutDomainNotificationsInternal({
  domainEvent,
  recipientIds = [],
  actorId = null,
  relatedId = null,
  relatedType = null,
  requestId = null,
  buildContextForRecipient,
  metricName = 'academic_notification_fanout_completed',
  requireExpansionFlag = true,
}) {
  const started = Date.now();

  if (requireExpansionFlag && !isAcademicNotificationExpansionEnabled()) {
    observability.metric('academic_notification_expansion_skipped', {
      domainEvent: domainEvent || null,
      reason: 'flag_disabled',
      recipientCount: recipientIds.length,
      durationMs: Date.now() - started,
    });
    return { delivered: 0, skipped: 0, suppressed: 0, failed: 0, reason: 'flag_disabled' };
  }

  if (!domainEvent || typeof buildContextForRecipient !== 'function') {
    return { delivered: 0, skipped: 0, suppressed: 0, failed: 0, reason: 'invalid_input' };
  }

  const targets = uniqueRecipientIds(excludeActorFromRecipients(recipientIds, actorId));
  const concurrency = resolveFanoutConcurrency();
  let prefetchCache = { users: new Map(), preferences: new Map() };
  if (mongoose.connection.readyState === 1 && targets.length) {
    try {
      prefetchCache = await prefetchNotificationRecipients(targets);
    } catch (error) {
      console.warn('notification_fanout_prefetch_failed', {
        domainEvent,
        message: error?.message || String(error),
      });
    }
  }

  const outcomes = await runWithConcurrencyLimit(targets, concurrency, async (recipientId) => {
    try {
      return await deliverNotificationToRecipient({
        domainEvent,
        recipientId,
        actorId,
        relatedId,
        relatedType,
        requestId,
        buildContextForRecipient,
        prefetchCache,
      });
    } catch (error) {
      console.error('academic_notification_fanout_recipient_failed', {
        domainEvent,
        recipientId,
        message: error?.message || String(error),
      });
      return 'failed';
    }
  });

  let delivered = 0;
  let skipped = 0;
  let suppressed = 0;
  let failed = 0;

  for (const outcome of outcomes) {
    if (outcome === 'delivered') delivered += 1;
    else if (outcome === 'skipped') skipped += 1;
    else if (outcome === 'suppressed') suppressed += 1;
    else if (outcome === 'failed') failed += 1;
  }

  observability.metric(metricName, {
    domainEvent,
    recipientCount: targets.length,
    delivered,
    skipped,
    suppressed,
    failed,
    concurrency,
    durationMs: Date.now() - started,
  });

  return { delivered, skipped, suppressed, failed, reason: null };
}

module.exports = {
  isAcademicNotificationExpansionEnabled,
  isPlannerMissingAssignmentsEnabled,
  normalizeObjectIdString,
  buildAcademicEventWindow,
  excludeActorFromRecipients,
  uniqueRecipientIds,
  resolveCourseStudentIds,
  resolveFanoutConcurrency,
  runWithConcurrencyLimit,
  fanoutAcademicDomainNotifications,
  fanoutBoundedDomainNotifications,
};
