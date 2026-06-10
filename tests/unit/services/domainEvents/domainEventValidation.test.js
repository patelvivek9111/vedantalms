const mongoose = require('mongoose');
const { validateAndNormalize } = require('../../../../services/domainEvents/domainEventValidation');
const {
  DOMAIN_EVENT_TYPES,
  AGGREGATE_TYPES,
  AUDIENCE_SCOPES,
} = require('../../../../services/domainEvents/domainEventTypes');

describe('domainEventValidation', () => {
  it('normalizes a valid domain event', () => {
    const aggregateId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();

    const normalized = validateAndNormalize({
      eventType: DOMAIN_EVENT_TYPES.ANNOUNCEMENT_CREATED,
      aggregateType: AGGREGATE_TYPES.ANNOUNCEMENT,
      aggregateId,
      actorId,
      audienceScope: AUDIENCE_SCOPES.COURSE,
      correlationId: 'corr-123',
      payload: { courseId: String(aggregateId) },
      metadata: { source: 'test' },
    });

    expect(normalized.eventType).toBe(DOMAIN_EVENT_TYPES.ANNOUNCEMENT_CREATED);
    expect(normalized.aggregateType).toBe(AGGREGATE_TYPES.ANNOUNCEMENT);
    expect(String(normalized.aggregateId)).toBe(String(aggregateId));
    expect(String(normalized.actorId)).toBe(String(actorId));
    expect(normalized.correlationId).toBe('corr-123');
    expect(normalized.payloadVersion).toBe(1);
    expect(normalized.payload).toEqual({ courseId: String(aggregateId) });
  });

  it('generates correlationId when missing', () => {
    const normalized = validateAndNormalize({
      eventType: DOMAIN_EVENT_TYPES.INBOX_MESSAGE_SENT,
      aggregateType: AGGREGATE_TYPES.MESSAGE,
      aggregateId: new mongoose.Types.ObjectId(),
    });

    expect(normalized.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('rejects unknown event types', () => {
    expect(() =>
      validateAndNormalize({
        eventType: 'NOT_A_REAL_EVENT',
        aggregateType: AGGREGATE_TYPES.COURSE,
        aggregateId: new mongoose.Types.ObjectId(),
      })
    ).toThrow(/invalid or missing eventType/);
  });

  it('rejects missing aggregateId', () => {
    expect(() =>
      validateAndNormalize({
        eventType: DOMAIN_EVENT_TYPES.COURSE_ENROLLMENT_APPROVED,
        aggregateType: AGGREGATE_TYPES.COURSE,
      })
    ).toThrow(/aggregateId is required/);
  });

  it('rejects invalid audienceScope', () => {
    expect(() =>
      validateAndNormalize({
        eventType: DOMAIN_EVENT_TYPES.MEETING_CREATED,
        aggregateType: AGGREGATE_TYPES.MEETING,
        aggregateId: new mongoose.Types.ObjectId(),
        audienceScope: 'invalid',
      })
    ).toThrow(/invalid audienceScope/);
  });
});
