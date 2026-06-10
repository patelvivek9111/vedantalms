const { DOMAIN_EVENTS } = require('../../../../services/domain/eventTaxonomy');
const {
  evaluateNotificationSuppression,
  evaluatePlannerSuppression,
} = require('../../../../services/domain/duplicationPolicy.service');

describe('duplicationPolicy.service', () => {
  it('suppresses instructor notification for enrollment.requested', () => {
    const result = evaluateNotificationSuppression({
      domainEvent: DOMAIN_EVENTS.ENROLLMENT_REQUESTED,
      recipientRole: 'teacher',
    });
    expect(result.suppress).toBe(true);
    expect(result.reason).toBe('contract_notification_not_applicable');
  });

  it('allows student notification for enrollment.approved', () => {
    const result = evaluateNotificationSuppression({
      domainEvent: DOMAIN_EVENTS.ENROLLMENT_APPROVED,
      recipientRole: 'student',
    });
    expect(result.suppress).toBe(false);
  });

  it('suppresses planner row for announcement.created', () => {
    const result = evaluatePlannerSuppression({
      domainEvent: DOMAIN_EVENTS.ANNOUNCEMENT_CREATED,
      recipientRole: 'student',
    });
    expect(result.suppress).toBe(true);
    expect(result.reason).toBe('contract_planner_not_applicable');
  });

  it('suppresses student planner enrollment_request rows', () => {
    const result = evaluatePlannerSuppression({
      domainEvent: DOMAIN_EVENTS.ENROLLMENT_REQUESTED,
      recipientRole: 'student',
    });
    expect(result.suppress).toBe(true);
    expect(result.reason).toBe('enrollment_request_instructor_only');
  });

  it('suppresses self-notifications when recipient equals actor', () => {
    const userId = '507f1f77bcf86cd799439011';
    const result = evaluateNotificationSuppression({
      domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      recipientRole: 'student',
      recipientId: userId,
      actorId: userId,
    });
    expect(result.suppress).toBe(true);
    expect(result.reason).toBe('self_notification');
  });

  it('suppresses discussion reply author with specific reason', () => {
    const userId = '507f1f77bcf86cd799439011';
    const result = evaluateNotificationSuppression({
      domainEvent: DOMAIN_EVENTS.DISCUSSION_REPLY,
      recipientRole: 'student',
      recipientId: userId,
      actorId: userId,
    });
    expect(result.suppress).toBe(true);
    expect(result.reason).toBe('discussion_reply_author');
  });

  it('allows assignment.created notification for distinct student recipient', () => {
    const result = evaluateNotificationSuppression({
      domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      recipientRole: 'student',
      recipientId: '507f1f77bcf86cd799439011',
      actorId: '507f1f77bcf86cd799439012',
    });
    expect(result.suppress).toBe(false);
  });
});
