const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  isKnownEventType,
  AUDIENCE_SCOPES,
} = require('./domainEventTypes');

const VALID_AUDIENCE = new Set(Object.values(AUDIENCE_SCOPES));

function normalizeObjectId(value) {
  if (value == null) return null;
  const id = value._id || value;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return String(id);
}

function stripPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return JSON.parse(JSON.stringify(payload));
}

function validateAndNormalize(input = {}) {
  const errors = [];

  if (!input.eventType || !isKnownEventType(input.eventType)) {
    errors.push('invalid or missing eventType');
  }
  if (!input.aggregateType || typeof input.aggregateType !== 'string') {
    errors.push('aggregateType is required');
  }
  if (!input.aggregateId) {
    errors.push('aggregateId is required');
  }

  if (errors.length) {
    const err = new Error(`domain_event_validation_failed: ${errors.join(', ')}`);
    err.code = 'DOMAIN_EVENT_VALIDATION';
    throw err;
  }

  const audienceScope = input.audienceScope || AUDIENCE_SCOPES.SYSTEM;
  if (!VALID_AUDIENCE.has(audienceScope)) {
    const err = new Error('domain_event_validation_failed: invalid audienceScope');
    err.code = 'DOMAIN_EVENT_VALIDATION';
    throw err;
  }

  const correlationId =
    input.correlationId ||
    input.metadata?.requestId ||
    input.metadata?.correlationId ||
    crypto.randomUUID();

  const actorId = normalizeObjectId(input.actorId);

  return {
    eventId: input.eventId || crypto.randomUUID(),
    eventType: input.eventType,
    aggregateType: String(input.aggregateType).trim(),
    aggregateId: String(input.aggregateId._id || input.aggregateId),
    actorId: actorId ? new mongoose.Types.ObjectId(actorId) : null,
    institutionId: input.institutionId != null ? String(input.institutionId) : null,
    audienceScope,
    correlationId: String(correlationId),
    payloadVersion: Number.isFinite(input.payloadVersion) ? input.payloadVersion : 1,
    payload: stripPayload(input.payload),
    metadata: stripPayload(input.metadata),
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
  };
}

module.exports = {
  validateAndNormalize,
  stripPayload,
};
