const mongoose = require('mongoose');

jest.mock('../../../services/domain/createNotificationFromDomainEvent', () => ({
  createNotificationFromDomainEvent: jest.fn(),
}));

jest.mock('../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

const { createNotificationFromDomainEvent } = require('../../../services/domain/createNotificationFromDomainEvent');
const { DOMAIN_EVENTS } = require('../../../services/domain/eventTaxonomy');
const observability = require('../../../services/workflowObservability.service');
const {
  resolveFanoutConcurrency,
  runWithConcurrencyLimit,
  fanoutAcademicDomainNotifications,
} = require('../../../services/notification/academicNotificationExpansion.service');

describe('academicNotificationExpansion.service phase11b sprint3', () => {
  const originalExpansion = process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED;
  const originalConcurrency = process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
    delete process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY;
    createNotificationFromDomainEvent.mockResolvedValue({ _id: 'n1' });
  });

  afterEach(() => {
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = originalExpansion;
    if (originalConcurrency == null) {
      delete process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY;
    } else {
      process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY = originalConcurrency;
    }
  });

  describe('resolveFanoutConcurrency', () => {
    it('defaults to 10', () => {
      expect(resolveFanoutConcurrency()).toBe(10);
    });

    it('parses valid env values', () => {
      process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY = '5';
      expect(resolveFanoutConcurrency()).toBe(5);
    });

    it('falls back to 10 for invalid env values', () => {
      process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY = 'bad';
      expect(resolveFanoutConcurrency()).toBe(10);
    });
  });

  it('delivers notifications concurrently', async () => {
    const recipientIds = Array.from({ length: 20 }, () => new mongoose.Types.ObjectId());
    let inFlight = 0;
    let maxInFlight = 0;

    createNotificationFromDomainEvent.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { _id: 'n1' };
    });

    process.env.ACADEMIC_NOTIFICATION_FANOUT_CONCURRENCY = '5';

    const result = await fanoutAcademicDomainNotifications({
      domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      recipientIds,
      actorId: new mongoose.Types.ObjectId(),
      relatedId: new mongoose.Types.ObjectId(),
      buildContextForRecipient: () => ({
        title: 'New Assignment',
        message: 'Hello',
        recipientRole: 'student',
      }),
    });

    expect(result.delivered).toBe(20);
    expect(result.failed).toBe(0);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(createNotificationFromDomainEvent).toHaveBeenCalledTimes(20);
  });

  it('continues fanout when a recipient fails', async () => {
    const recipients = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    createNotificationFromDomainEvent
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ _id: 'n2' });

    const result = await fanoutAcademicDomainNotifications({
      domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      recipientIds: recipients,
      actorId: new mongoose.Types.ObjectId(),
      relatedId: new mongoose.Types.ObjectId(),
      buildContextForRecipient: () => ({
        title: 'New Assignment',
        message: 'Hello',
        recipientRole: 'student',
      }),
    });

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(1);
    expect(createNotificationFromDomainEvent).toHaveBeenCalledTimes(2);
  });

  it('records hardened fanout metrics', async () => {
    const actorId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();

    await fanoutAcademicDomainNotifications({
      domainEvent: DOMAIN_EVENTS.DISCUSSION_REPLY,
      recipientIds: [recipientId, actorId],
      actorId,
      relatedId: new mongoose.Types.ObjectId(),
      buildContextForRecipient: () => ({
        title: 'Reply',
        message: 'New reply',
        recipientRole: 'student',
      }),
    });

    expect(observability.metric).toHaveBeenCalledWith(
      'academic_notification_fanout_completed',
      expect.objectContaining({
        domainEvent: DOMAIN_EVENTS.DISCUSSION_REPLY,
        recipientCount: 1,
        delivered: 1,
        skipped: 0,
        suppressed: 0,
        failed: 0,
        durationMs: expect.any(Number),
      })
    );
  });

  it('preserves actor suppression under concurrent fanout', async () => {
    const actorId = new mongoose.Types.ObjectId();

    const result = await fanoutAcademicDomainNotifications({
      domainEvent: DOMAIN_EVENTS.DISCUSSION_REPLY,
      recipientIds: [actorId],
      actorId,
      relatedId: new mongoose.Types.ObjectId(),
      buildContextForRecipient: () => ({
        title: 'Reply',
        message: 'New reply',
        recipientRole: 'student',
      }),
    });

    expect(result.delivered).toBe(0);
    expect(createNotificationFromDomainEvent).not.toHaveBeenCalled();
    expect(observability.metric).toHaveBeenCalledWith(
      'academic_notification_fanout_completed',
      expect.objectContaining({ recipientCount: 0, delivered: 0 })
    );
  });

  it('respects concurrency limit via runWithConcurrencyLimit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await runWithConcurrencyLimit([1, 2, 3, 4, 5, 6], 2, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
