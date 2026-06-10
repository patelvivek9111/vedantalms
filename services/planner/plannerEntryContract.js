const { getEventContract } = require('../domain/plannerNotificationContract');
const { evaluatePlannerSuppression } = require('../domain/duplicationPolicy.service');

/**
 * Planner-side contract helpers (Todo documents + derived assignment/discussion feeds).
 * Derived feeds remain endpoint-centric until PR-9+ persistence work.
 */

function describePlannerSurfaceForEvent(domainEvent, context = {}) {
  const contract = getEventContract(domainEvent);
  const suppression = evaluatePlannerSuppression({
    domainEvent,
    recipientRole: context.recipientRole,
  });

  return {
    domainEvent,
    contract,
    shouldSurface: !suppression.suppress,
    suppressReason: suppression.reason,
    todoType: contract?.plannerTodoType ?? null,
    ownerRoles: contract?.plannerOwnerRoles ?? [],
  };
}

module.exports = {
  describePlannerSurfaceForEvent,
};
