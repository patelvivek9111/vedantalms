const mongoose = require('mongoose');

jest.mock('../../../services/domain/createNotificationFromDomainEvent', () => ({
  createNotificationFromDomainEvent: jest.fn().mockResolvedValue({ _id: 'n1' }),
}));

jest.mock('../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

const { createNotificationFromDomainEvent } = require('../../../services/domain/createNotificationFromDomainEvent');
const { DOMAIN_EVENTS } = require('../../../services/domain/eventTaxonomy');
const {
  isAcademicNotificationExpansionEnabled,
  isPlannerMissingAssignmentsEnabled,
  buildAcademicEventWindow,
  excludeActorFromRecipients,
  uniqueRecipientIds,
  fanoutAcademicDomainNotifications,
} = require('../../../services/notification/academicNotificationExpansion.service');

describe('academicNotificationExpansion.service', () => {
  const originalExpansion = process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED;
  const originalPlanner = process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED;
    delete process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED;
  });

  afterAll(() => {
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = originalExpansion;
    process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED = originalPlanner;
  });

  it('is disabled by default for academic notification expansion', () => {
    expect(isAcademicNotificationExpansionEnabled()).toBe(false);
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
    expect(isAcademicNotificationExpansionEnabled()).toBe(true);
  });

  it('is disabled by default for planner missing assignments', () => {
    expect(isPlannerMissingAssignmentsEnabled()).toBe(false);
    process.env.PLANNER_MISSING_ASSIGNMENTS_ENABLED = 'true';
    expect(isPlannerMissingAssignmentsEnabled()).toBe(true);
  });

  it('builds stable academic event windows', () => {
    const actorId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();
    const relatedId = new mongoose.Types.ObjectId();

    const window = buildAcademicEventWindow({
      domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      relatedId,
      recipientId,
      actorId,
    });

    expect(window).toBe(
      `${DOMAIN_EVENTS.ASSIGNMENT_CREATED}:${String(relatedId)}:${String(recipientId)}:${String(actorId)}`
    );
  });

  it('excludes actor from recipient lists', () => {
    const actorId = new mongoose.Types.ObjectId();
    const otherId = new mongoose.Types.ObjectId();
    const ids = excludeActorFromRecipients([actorId, otherId, actorId], actorId);
    expect(ids).toEqual([String(otherId)]);
    expect(uniqueRecipientIds([otherId, otherId, otherId])).toEqual([String(otherId)]);
  });

  it('does not fan out when expansion flag is disabled', async () => {
    const recipientId = new mongoose.Types.ObjectId();

    const result = await fanoutAcademicDomainNotifications({
      domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      recipientIds: [recipientId],
      actorId: new mongoose.Types.ObjectId(),
      relatedId: new mongoose.Types.ObjectId(),
      buildContextForRecipient: () => ({
        title: 'New Assignment',
        message: 'Hello',
        recipientRole: 'student',
      }),
    });

    expect(result).toEqual({
      delivered: 0,
      skipped: 0,
      suppressed: 0,
      failed: 0,
      reason: 'flag_disabled',
    });
    expect(createNotificationFromDomainEvent).not.toHaveBeenCalled();
  });

  it('fans out when expansion flag is enabled', async () => {
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
    const recipientId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const relatedId = new mongoose.Types.ObjectId();

    const result = await fanoutAcademicDomainNotifications({
      domainEvent: DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      recipientIds: [recipientId],
      actorId,
      relatedId,
      relatedType: 'assignment',
      buildContextForRecipient: (id) => ({
        title: 'New Assignment',
        message: 'A new assignment is available',
        recipientRole: 'student',
        relatedId,
        link: '/courses/1/assignments/1',
      }),
    });

    expect(result.delivered).toBe(1);
    expect(createNotificationFromDomainEvent).toHaveBeenCalledTimes(1);
    expect(createNotificationFromDomainEvent).toHaveBeenCalledWith(
      DOMAIN_EVENTS.ASSIGNMENT_CREATED,
      expect.objectContaining({
        userId: String(recipientId),
        eventWindow: expect.stringContaining(DOMAIN_EVENTS.ASSIGNMENT_CREATED),
      })
    );
  });

  it('suppresses self-notifications during fanout', async () => {
    process.env.ACADEMIC_NOTIFICATION_EXPANSION_ENABLED = 'true';
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
    expect(result.suppressed).toBe(0);
    expect(createNotificationFromDomainEvent).not.toHaveBeenCalled();
  });
});
