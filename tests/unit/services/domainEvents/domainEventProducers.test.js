const mongoose = require('mongoose');
const {
  recordDomainEvent,
  DOMAIN_EVENT_TYPES,
  AGGREGATE_TYPES,
  AUDIENCE_SCOPES,
} = require('../../../../services/domainEvents');

jest.mock('../../../../models/domainEvent.model', () => ({
  create: jest.fn(),
}));

const DomainEvent = require('../../../../models/domainEvent.model');

describe('domain event producer payloads', () => {
  const originalFlag = process.env.DOMAIN_EVENTS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DOMAIN_EVENTS_ENABLED = 'true';
  });

  afterAll(() => {
    process.env.DOMAIN_EVENTS_ENABLED = originalFlag;
  });

  const producerCases = [
    {
      name: 'announcement',
      input: {
        eventType: DOMAIN_EVENT_TYPES.ANNOUNCEMENT_CREATED,
        aggregateType: AGGREGATE_TYPES.ANNOUNCEMENT,
        aggregateId: new mongoose.Types.ObjectId(),
        actorId: new mongoose.Types.ObjectId(),
        audienceScope: AUDIENCE_SCOPES.COURSE,
        correlationId: 'req-announce',
        payload: { courseId: 'course-1', title: 'Hello', postTo: 'all' },
        metadata: { source: 'announcement.controller.createAnnouncement' },
      },
    },
    {
      name: 'submission',
      input: {
        eventType: DOMAIN_EVENT_TYPES.ASSIGNMENT_SUBMITTED,
        aggregateType: AGGREGATE_TYPES.SUBMISSION,
        aggregateId: new mongoose.Types.ObjectId(),
        actorId: new mongoose.Types.ObjectId(),
        audienceScope: AUDIENCE_SCOPES.COURSE,
        correlationId: 'req-submit',
        payload: { assignmentId: 'a1', courseId: 'c1' },
        metadata: { source: 'submission.controller.submit' },
      },
    },
    {
      name: 'enrollment approved',
      input: {
        eventType: DOMAIN_EVENT_TYPES.COURSE_ENROLLMENT_APPROVED,
        aggregateType: AGGREGATE_TYPES.COURSE,
        aggregateId: new mongoose.Types.ObjectId(),
        actorId: new mongoose.Types.ObjectId(),
        audienceScope: AUDIENCE_SCOPES.USER,
        correlationId: 'req-enroll',
        payload: { studentId: 's1', courseId: 'c1' },
        metadata: { source: 'course.routes.enrollment.approve' },
      },
    },
    {
      name: 'planner dismiss',
      input: {
        eventType: DOMAIN_EVENT_TYPES.PLANNER_ITEM_DISMISSED,
        aggregateType: AGGREGATE_TYPES.PLANNER_ITEM,
        aggregateId: 'todo:assignment:abc',
        actorId: new mongoose.Types.ObjectId(),
        audienceScope: AUDIENCE_SCOPES.USER,
        correlationId: 'req-planner',
        payload: { itemKey: 'todo:assignment:abc' },
        metadata: { source: 'planner.controller.dismissPlannerItem' },
      },
    },
  ];

  it.each(producerCases)('records $name events', async ({ input }) => {
    DomainEvent.create.mockImplementation(async (doc) => doc);

    const saved = await recordDomainEvent(input);

    expect(saved).toBeTruthy();
    expect(DomainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        correlationId: input.correlationId,
      })
    );
  });
});
