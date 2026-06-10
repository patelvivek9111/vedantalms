const { DOMAIN_EVENTS, SURFACE_KIND, OWNERSHIP } = require('./eventTaxonomy');
const {
  EVENT_CONTRACTS,
  getEventContract,
  listEventContracts,
  isKnownDomainEvent,
} = require('./plannerNotificationContract');
const {
  evaluateNotificationSuppression,
  evaluatePlannerSuppression,
  shouldDeliverNotification,
  shouldSurfacePlannerEntry,
} = require('./duplicationPolicy.service');
const { buildNotificationIntent } = require('./notificationIntentAdapter');
const { createNotificationFromDomainEvent } = require('./createNotificationFromDomainEvent');

module.exports = {
  DOMAIN_EVENTS,
  SURFACE_KIND,
  OWNERSHIP,
  EVENT_CONTRACTS,
  getEventContract,
  listEventContracts,
  isKnownDomainEvent,
  evaluateNotificationSuppression,
  evaluatePlannerSuppression,
  shouldDeliverNotification,
  shouldSurfacePlannerEntry,
  buildNotificationIntent,
  createNotificationFromDomainEvent,
};
