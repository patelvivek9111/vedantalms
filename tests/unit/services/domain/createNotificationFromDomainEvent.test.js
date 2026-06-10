jest.mock('../../../../services/notification/notificationCreate.service', () => ({
  createNotification: jest.fn().mockResolvedValue({ _id: 'n1' }),
}));

jest.mock('../../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

const { createNotification } = require('../../../../services/notification/notificationCreate.service');
const observability = require('../../../../services/workflowObservability.service');
const { DOMAIN_EVENTS } = require('../../../../services/domain/eventTaxonomy');
const { createNotificationFromDomainEvent } = require('../../../../services/domain/createNotificationFromDomainEvent');

describe('createNotificationFromDomainEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to createNotification when contract allows delivery', async () => {
    const result = await createNotificationFromDomainEvent(DOMAIN_EVENTS.ENROLLMENT_APPROVED, {
      userId: '507f1f77bcf86cd799439011',
      recipientRole: 'student',
      title: 'Approved',
      message: 'You are in',
      relatedId: '507f1f77bcf86cd799439012',
      relatedType: 'course',
    });

    expect(result).toEqual({ _id: 'n1' });
    expect(createNotification).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({ type: 'enrollment' }),
      expect.objectContaining({ source: DOMAIN_EVENTS.ENROLLMENT_APPROVED })
    );
  });

  it('skips createNotification when suppressed', async () => {
    const result = await createNotificationFromDomainEvent(DOMAIN_EVENTS.ENROLLMENT_REQUESTED, {
      userId: '507f1f77bcf86cd799439011',
      recipientRole: 'teacher',
      title: 'Pending',
      message: 'Review enrollment',
      relatedId: '507f1f77bcf86cd799439012',
      relatedType: 'course',
    });

    expect(result).toBeNull();
    expect(createNotification).not.toHaveBeenCalled();
    expect(observability.metric).toHaveBeenCalledWith(
      'notification_domain_event_skipped',
      expect.objectContaining({ domainEvent: DOMAIN_EVENTS.ENROLLMENT_REQUESTED })
    );
  });
});
