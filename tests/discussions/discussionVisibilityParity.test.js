jest.mock('../../services/discussionWorkflow.service', () => ({
  deriveDiscussionWorkflowState: jest.fn((thread) => ({
    locked: thread.locked === true,
    archived: Boolean(thread.archivedAt),
  })),
}));

jest.mock('../../services/discussionGradeVisibility.service', () => ({
  findStudentGrade: jest.fn((thread) => thread.studentGrades?.[0] || null),
  resolveDiscussionGradeVisibility: jest.fn((thread) => ({
    scoreVisible: thread.gradeHidden !== true && thread.discussionReleaseMode !== 'hidden',
  })),
}));

const status = require('../../services/discussionStatus.service');

describe('discussion visibility parity status', () => {
  it('marks hidden graded discussions as pending release', () => {
    expect(status.resolveDiscussionStatus({
      published: true,
      isGraded: true,
      gradeHidden: true,
      discussionReleaseMode: 'hidden',
      studentGrades: [{ grade: 95 }],
    }, { user: { _id: 'student1' } })).toBe('graded_pending_release');
  });

  it('marks locked discussions as locked before available', () => {
    expect(status.resolveDiscussionStatus({ published: true, locked: true })).toBe('locked');
  });
});
