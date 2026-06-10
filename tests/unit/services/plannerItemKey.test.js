const {
  resolveItemKeyFromFeedItem,
  buildDerivedMissingAssignmentKey,
  buildDerivedOverdueAssignmentKey,
} = require('../../../services/planner/plannerItemKey.service');

describe('plannerItemKey.service', () => {
  it('resolves missing and overdue assignment keys from subType', () => {
    const assignmentId = 'abc123';
    expect(
      resolveItemKeyFromFeedItem({
        _id: assignmentId,
        type: 'assignment',
        subType: 'missing',
      })
    ).toBe(buildDerivedMissingAssignmentKey(assignmentId));
    expect(
      resolveItemKeyFromFeedItem({
        _id: assignmentId,
        type: 'assignment',
        subType: 'overdue',
      })
    ).toBe(buildDerivedOverdueAssignmentKey(assignmentId));
  });
});
