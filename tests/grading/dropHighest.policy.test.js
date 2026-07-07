const { filterAssignmentsForDropRules } = require('../../shared/grading/dropRules.cjs');
const { getDroppedAssignmentIds } = require('../../shared/grading/dropHighest.cjs');

describe('dropHighest policy', () => {
  const studentId = 's1';
  const groupName = 'Assignments';

  it('drops highest scored assignment when enabled', () => {
    const assignments = [
      { _id: 'a-high', group: groupName, totalPoints: 100, published: true },
      { _id: 'a-low', group: groupName, totalPoints: 100, published: true },
    ];
    const grades = { [studentId]: { 'a-high': 95, 'a-low': 60 } };
    const submissions = { 'a-high': {}, 'a-low': {} };
    const policy = {
      dropHighest: { enabled: true, rules: [{ groupName, count: 1 }] },
    };

    const dropped = getDroppedAssignmentIds(
      assignments,
      studentId,
      grades,
      submissions,
      policy.dropHighest,
      groupName
    );
    expect(dropped.has('a-high')).toBe(true);
    expect(dropped.has('a-low')).toBe(false);

    const filtered = filterAssignmentsForDropRules(
      assignments,
      studentId,
      grades,
      submissions,
      policy,
      groupName
    );
    expect(filtered.map((a) => String(a._id))).toEqual(['a-low']);
  });
});
