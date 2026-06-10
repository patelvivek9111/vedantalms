const DomainEvent = require('../../models/domainEvent.model');
const observability = require('../workflowObservability.service');
const { validateAndNormalize } = require('./domainEventValidation');

function isDomainEventsEnabled() {
  return process.env.DOMAIN_EVENTS_ENABLED === 'true';
}

function recordDomainEventMetric(name, fields = {}) {
  observability.metric(name, fields);
}

/**
 * Append-only domain event persistence. Producer-safe: never throws.
 * @returns {Promise<object|null>} saved document or null
 */
async function recordDomainEvent(input = {}) {
  const started = Date.now();
  const eventType = input?.eventType || 'unknown';

  if (!isDomainEventsEnabled()) {
    recordDomainEventMetric('domain_event_skipped', {
      eventType,
      reason: 'flag_disabled',
      durationMs: Date.now() - started,
      result: 'skipped',
    });
    return null;
  }

  try {
    const normalized = validateAndNormalize(input);
    const saved = await DomainEvent.create(normalized);

    recordDomainEventMetric('domain_event_created', {
      eventType: saved.eventType,
      aggregateType: saved.aggregateType,
      durationMs: Date.now() - started,
      result: 'created',
    });

    return saved;
  } catch (error) {
    recordDomainEventMetric('domain_event_failed', {
      eventType,
      reason: error?.code || error?.name || 'error',
      durationMs: Date.now() - started,
      result: 'failed',
    });
    console.error('domain_event_record_failed', {
      eventType,
      error: error?.message || String(error),
    });
    return null;
  }
}

module.exports = {
  isDomainEventsEnabled,
  recordDomainEvent,
};
