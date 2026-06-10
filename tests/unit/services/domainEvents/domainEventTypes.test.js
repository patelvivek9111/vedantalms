const {
  DOMAIN_EVENT_TYPES,
  KNOWN_EVENT_TYPES,
  isKnownEventType,
} = require('../../../../services/domainEvents/domainEventTypes');

describe('domainEventTypes', () => {
  it('exposes canonical event constants without duplicates', () => {
    const values = Object.values(DOMAIN_EVENT_TYPES);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain('ANNOUNCEMENT_CREATED');
    expect(values).toContain('ASSIGNMENT_SUBMITTED');
    expect(values).toContain('PLANNER_ITEM_SNOOZED');
  });

  it('KNOWN_EVENT_TYPES matches all constants', () => {
    for (const value of Object.values(DOMAIN_EVENT_TYPES)) {
      expect(KNOWN_EVENT_TYPES.has(value)).toBe(true);
      expect(isKnownEventType(value)).toBe(true);
    }
    expect(isKnownEventType('announcement.created')).toBe(false);
  });
});
