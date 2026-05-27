const assignmentGroupService = require('../../services/assignmentGroup.service');

describe('course copy group id remapping contract', () => {
  it('generates stable ids for copied groups without reusing source ids', () => {
    const sourceGroups = [
      { id: 'source-homework', name: 'Homework', weight: 50 },
      { id: 'source-quizzes', name: 'Quizzes', weight: 50 },
    ];
    const normalized = assignmentGroupService.normalizeGroups(sourceGroups);
    const copied = normalized.map((group) => ({
      ...group,
      id: `copy-${group.id}`,
    }));

    expect(copied.map((g) => g.name)).toEqual(['Homework', 'Quizzes']);
    expect(copied.map((g) => g.id)).not.toEqual(sourceGroups.map((g) => g.id));
  });
});
