const mongoose = require('mongoose');

jest.mock('../../../../models/domainEvent.model', () => ({
  create: jest.fn(),
}));

jest.mock('../../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

const DomainEvent = require('../../../../models/domainEvent.model');
const observability = require('../../../../services/workflowObservability.service');
const {
  isDomainEventsEnabled,
  recordDomainEvent,
} = require('../../../../services/domainEvents/domainEvent.service');
const {
  DOMAIN_EVENT_TYPES,
  AGGREGATE_TYPES,
  AUDIENCE_SCOPES,
} = require('../../../../services/domainEvents/domainEventTypes');

describe('domainEvent.service', () => {
  const originalFlag = process.env.DOMAIN_EVENTS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DOMAIN_EVENTS_ENABLED;
  });

  afterAll(() => {
    process.env.DOMAIN_EVENTS_ENABLED = originalFlag;
  });

  it('is disabled unless DOMAIN_EVENTS_ENABLED=true', () => {
    expect(isDomainEventsEnabled()).toBe(false);
    process.env.DOMAIN_EVENTS_ENABLED = 'true';
    expect(isDomainEventsEnabled()).toBe(true);
  });

  it('skips persistence and emits skipped metric when flag is off', async () => {
    const result = await recordDomainEvent({
      eventType: DOMAIN_EVENT_TYPES.ANNOUNCEMENT_CREATED,
      aggregateType: AGGREGATE_TYPES.ANNOUNCEMENT,
      aggregateId: new mongoose.Types.ObjectId(),
    });

    expect(result).toBeNull();
    expect(DomainEvent.create).not.toHaveBeenCalled();
    expect(observability.metric).toHaveBeenCalledWith(
      'domain_event_skipped',
      expect.objectContaining({ eventType: DOMAIN_EVENT_TYPES.ANNOUNCEMENT_CREATED, result: 'skipped' })
    );
  });

  it('persists and emits created metric when flag is on', async () => {
    process.env.DOMAIN_EVENTS_ENABLED = 'true';
    const saved = { eventType: DOMAIN_EVENT_TYPES.INBOX_MESSAGE_SENT };
    DomainEvent.create.mockResolvedValue(saved);

    const aggregateId = new mongoose.Types.ObjectId();
    const result = await recordDomainEvent({
      eventType: DOMAIN_EVENT_TYPES.INBOX_MESSAGE_SENT,
      aggregateType: AGGREGATE_TYPES.MESSAGE,
      aggregateId,
      actorId: new mongoose.Types.ObjectId(),
      audienceScope: AUDIENCE_SCOPES.USER,
      correlationId: 'req-1',
      payload: { conversationId: 'abc' },
      metadata: { source: 'test' },
    });

    expect(result).toBe(saved);
    expect(DomainEvent.create).toHaveBeenCalledTimes(1);
    expect(observability.metric).toHaveBeenCalledWith(
      'domain_event_created',
      expect.objectContaining({
        eventType: DOMAIN_EVENT_TYPES.INBOX_MESSAGE_SENT,
        result: 'created',
      })
    );
  });

  it('never throws on validation failure', async () => {
    process.env.DOMAIN_EVENTS_ENABLED = 'true';

    const result = await recordDomainEvent({
      eventType: 'INVALID',
      aggregateType: AGGREGATE_TYPES.COURSE,
      aggregateId: new mongoose.Types.ObjectId(),
    });

    expect(result).toBeNull();
    expect(DomainEvent.create).not.toHaveBeenCalled();
    expect(observability.metric).toHaveBeenCalledWith(
      'domain_event_failed',
      expect.objectContaining({ result: 'failed' })
    );
  });
});
