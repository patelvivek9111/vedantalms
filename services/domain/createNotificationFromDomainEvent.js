const { createNotification } = require('../notification/notificationCreate.service');
const { buildNotificationIntent } = require('./notificationIntentAdapter');
const observability = require('../workflowObservability.service');

/**
 * Transitional producer entrypoint: domain event → contract check → createNotification.
 * Preserves existing Notification schema and API responses.
 */
async function createNotificationFromDomainEvent(domainEvent, context = {}) {
  const { prefetchCache, ...rest } = context;
  const intent = buildNotificationIntent(domainEvent, rest);

  if (!intent.deliver) {
    observability.metric('notification_domain_event_skipped', {
      domainEvent: domainEvent || null,
      reason: intent.reason || 'unknown',
      recipientRole: context.recipientRole || null,
    });
    return null;
  }

  return createNotification(context.userId, intent.notificationData, {
    ...intent.options,
    prefetchCache,
  });
}

module.exports = {
  createNotificationFromDomainEvent,
};
