const assignmentGroupService = require('../../services/assignmentGroup.service');

describe('assignment group id hardening', () => {
  it('preserves stable group ids across renames', () => {
    const existingGroups = [{ id: 'g1', name: 'Homework', weight: 40 }];
    const normalized = assignmentGroupService.normalizeGroups(
      [{ name: 'Homework', weight: 45 }],
      existingGroups
    );
    expect(normalized[0]).toMatchObject({ id: 'g1', name: 'Homework', weight: 45 });
  });

  it('prefers groupId over display name when resolving assignment category', () => {
    const course = {
      groups: [
        { id: 'g1', name: 'Homework Renamed', weight: 40 },
        { id: 'g2', name: 'Quizzes', weight: 60 },
      ],
    };
    const assignment = { group: 'Homework', groupId: 'g1' };

    assignmentGroupService.applyAssignmentGroupSelection(assignment, course, {
      group: 'Quizzes',
      groupId: 'g1',
    });

    expect(assignment.groupId).toBe('g1');
    expect(assignment.group).toBe('Homework Renamed');
  });

  it('falls back to legacy group names for backward compatibility', () => {
    const course = { groups: [{ id: 'g2', name: 'Quizzes', weight: 60 }] };
    const assignment = {};
    assignmentGroupService.applyAssignmentGroupSelection(assignment, course, { group: 'Quizzes' });
    expect(assignment).toMatchObject({ groupId: 'g2', group: 'Quizzes' });
  });
});
