const {
  computePriorityScore,
  rankPlannerItems,
  applyFeedCap,
} = require('../../../services/planner/plannerPriority.service');

describe('plannerPriority.service', () => {
  it('ranks overdue items above distant due items', () => {
    const now = new Date('2026-05-28T12:00:00.000Z');
    const items = [
      { title: 'Later', dueDate: new Date('2026-06-10T12:00:00.000Z') },
      { title: 'Soon', dueDate: new Date('2026-05-28T18:00:00.000Z') },
    ];
    const ranked = rankPlannerItems(items, now);
    expect(ranked[0].title).toBe('Soon');
  });

  it('boosts teacher ungraded workload', () => {
    const now = new Date('2026-05-28T12:00:00.000Z');
    const low = computePriorityScore({ dueDate: new Date('2026-06-10T12:00:00.000Z') }, now);
    const high = computePriorityScore({ ungradedCount: 12 }, now);
    expect(high).toBeGreaterThan(low);
  });

  it('boosts missing and overdue assignment subtypes', () => {
    const dueSoon = computePriorityScore({
      type: 'assignment',
      dueDate: new Date('2026-05-28T18:00:00.000Z'),
    }, new Date('2026-05-28T12:00:00.000Z'));
    const missing = computePriorityScore({
      type: 'assignment',
      subType: 'missing',
      dueDate: new Date('2026-05-27T12:00:00.000Z'),
    }, new Date('2026-05-28T12:00:00.000Z'));
    const overdue = computePriorityScore({
      type: 'assignment',
      subType: 'overdue',
      dueDate: new Date('2026-05-20T12:00:00.000Z'),
    }, new Date('2026-05-28T12:00:00.000Z'));
    expect(missing).toBeGreaterThan(dueSoon);
    expect(overdue).toBeGreaterThan(missing);
  });

  it('applies feed cap', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ title: `t${i}` }));
    const result = applyFeedCap(items, 3);
    expect(result.items).toHaveLength(3);
    expect(result.capped).toBe(true);
    expect(result.totalBeforeCap).toBe(10);
  });
});
