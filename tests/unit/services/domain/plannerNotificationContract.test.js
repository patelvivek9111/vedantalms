const { DOMAIN_EVENTS } = require('../../../../services/domain/eventTaxonomy');
const {
  getEventContract,
  isKnownDomainEvent,
  listEventContracts,
} = require('../../../../services/domain/plannerNotificationContract');

describe('plannerNotificationContract', () => {
  it('exposes contracts for all DOMAIN_EVENTS keys', () => {
    const keys = Object.values(DOMAIN_EVENTS);
    for (const key of keys) {
      expect(isKnownDomainEvent(key)).toBe(true);
      expect(getEventContract(key)?.domainEvent).toBe(key);
    }
    expect(listEventContracts().length).toBeGreaterThanOrEqual(keys.length);
  });

  it('assigns enrollment.requested to planner owner', () => {
    const contract = getEventContract(DOMAIN_EVENTS.ENROLLMENT_REQUESTED);
    expect(contract.deliversPlannerEntry).toBe(true);
    expect(contract.deliversNotification).toBe(false);
    expect(contract.plannerTodoType).toBe('enrollment_request');
  });

  it('assigns announcement.created to notification only', () => {
    const contract = getEventContract(DOMAIN_EVENTS.ANNOUNCEMENT_CREATED);
    expect(contract.deliversNotification).toBe(true);
    expect(contract.deliversPlannerEntry).toBe(false);
  });
});
