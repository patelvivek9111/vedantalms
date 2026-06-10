const {
  DOMAIN_EVENT_TYPES,
  AGGREGATE_TYPES,
  AUDIENCE_SCOPES,
  isKnownEventType,
} = require('./domainEventTypes');
const { validateAndNormalize } = require('./domainEventValidation');
const { isDomainEventsEnabled, recordDomainEvent } = require('./domainEvent.service');

module.exports = {
  DOMAIN_EVENT_TYPES,
  AGGREGATE_TYPES,
  AUDIENCE_SCOPES,
  isKnownEventType,
  validateAndNormalize,
  isDomainEventsEnabled,
  recordDomainEvent,
};
