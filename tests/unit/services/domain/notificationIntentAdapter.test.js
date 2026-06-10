const { DOMAIN_EVENTS } = require('../../../../services/domain/eventTaxonomy');
const { buildNotificationIntent } = require('../../../../services/domain/notificationIntentAdapter');

describe('notificationIntentAdapter', () => {
  const baseContext = {
    userId: '507f1f77bcf86cd799439011',
    title: 'Test',
    message: 'Body',
    relatedId: '507f1f77bcf86cd799439012',
    relatedType: 'announcement',
  };

  it('builds deliverable intent for announcement.created', () => {
    const intent = buildNotificationIntent(DOMAIN_EVENTS.ANNOUNCEMENT_CREATED, {
      ...baseContext,
      recipientRole: 'student',
      link: '/courses/1/announcements',
    });

    expect(intent.deliver).toBe(true);
    expect(intent.notificationData.type).toBe('announcement');
    expect(intent.options.source).toBe(DOMAIN_EVENTS.ANNOUNCEMENT_CREATED);
  });

  it('skips instructor notification for enrollment.requested', () => {
    const intent = buildNotificationIntent(DOMAIN_EVENTS.ENROLLMENT_REQUESTED, {
      ...baseContext,
      recipientRole: 'teacher',
      notificationType: 'enrollment',
    });

    expect(intent.deliver).toBe(false);
    expect(intent.reason).toBe('contract_notification_not_applicable');
  });

  it('rejects missing required fields', () => {
    const intent = buildNotificationIntent(DOMAIN_EVENTS.ANNOUNCEMENT_CREATED, {
      recipientRole: 'student',
    });

    expect(intent.deliver).toBe(false);
    expect(intent.reason).toBe('missing_required_intent_fields');
  });
});
