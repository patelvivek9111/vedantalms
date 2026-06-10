const { getEventContract } = require('./plannerNotificationContract');
const { evaluateNotificationSuppression } = require('./duplicationPolicy.service');

/**
 * Build a createNotification-ready intent from a domain event + producer context.
 * Does not perform DB writes.
 *
 * @param {string} domainEvent
 * @param {object} context
 * @param {string} context.userId
 * @param {string} [context.recipientRole]
 * @param {string} context.title
 * @param {string} context.message
 * @param {string} [context.link]
 * @param {import('mongoose').Types.ObjectId|string} [context.relatedId]
 * @param {string} [context.relatedType]
 * @param {string} [context.priority]
 * @param {import('mongoose').Types.ObjectId|string} [context.actorId]
 * @param {import('mongoose').Types.ObjectId|string} [context.courseId]
 * @param {import('mongoose').Types.ObjectId|string} [context.assignmentId]
 * @param {string} [context.eventWindow]
 * @param {string} [context.requestId]
 * @param {string} [context.notificationType] - override contract default
 */
function buildNotificationIntent(domainEvent, context = {}) {
  const contract = getEventContract(domainEvent);
  const notificationType =
    context.notificationType || contract?.notificationType || null;

  const suppression = evaluateNotificationSuppression({
    domainEvent,
    recipientRole: context.recipientRole,
    notificationType,
    recipientId: context.userId,
    actorId: context.actorId,
  });

  if (!context.userId || !context.title || !context.message) {
    return {
      deliver: false,
      reason: 'missing_required_intent_fields',
      domainEvent,
      contract,
      notificationData: null,
      options: null,
    };
  }

  if (!notificationType) {
    return {
      deliver: false,
      reason: 'missing_notification_type',
      domainEvent,
      contract,
      notificationData: null,
      options: null,
    };
  }

  if (suppression.suppress) {
    return {
      deliver: false,
      reason: suppression.reason,
      domainEvent,
      contract,
      notificationData: null,
      options: null,
    };
  }

  const notificationData = {
    type: notificationType,
    title: context.title,
    message: context.message,
    link: context.link ?? null,
    relatedId: context.relatedId ?? null,
    relatedType: context.relatedType ?? null,
    priority: context.priority || 'medium',
    metadata: {
      domainEvent,
      ...(context.courseId != null ? { courseId: String(context.courseId) } : {}),
      ...(context.assignmentId != null
        ? { assignmentId: String(context.assignmentId) }
        : {}),
    },
  };

  const options = {
    source: domainEvent,
    actorId: context.actorId ?? null,
    eventWindow: context.eventWindow ?? null,
    requestId: context.requestId ?? null,
    domainEvent,
  };

  return {
    deliver: true,
    reason: null,
    domainEvent,
    contract,
    notificationData,
    options,
  };
}

module.exports = {
  buildNotificationIntent,
};
