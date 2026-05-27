const visibility = require('../../services/discussionGradeVisibility.service');
const { resolveAssignmentGrade } = require('../../utils/gradeCalculation');

function thread(overrides = {}) {
  return {
    _id: 'thread1',
    isGraded: true,
    discussionReleaseMode: 'manual',
    gradesReleasedAt: null,
    gradeHidden: false,
    studentGrades: [{ student: 'student1', grade: 8, feedback: 'Good post' }],
    ...overrides,
  };
}

describe('discussion grade visibility policy', () => {
  it('hides manual discussion grades until released', () => {
    const discussion = thread();
    const row = visibility.findStudentGrade(discussion, 'student1');
    expect(visibility.resolveDiscussionGradeVisibility(discussion, row)).toMatchObject({
      scoreVisible: false,
      feedbackVisible: false,
    });
    expect(visibility.discussionGradeForTotals(discussion, 'student1')).toBeNull();
  });

  it('exposes only the requesting student released grade', () => {
    const discussion = thread({
      discussionReleaseMode: 'manual',
      gradesReleasedAt: new Date('2026-01-20T00:00:00.000Z'),
      studentGrades: [
        { student: 'student1', grade: 8, feedback: 'Good post' },
        { student: 'student2', grade: 4, feedback: 'Needs work' },
      ],
    });
    const rows = visibility.filterStudentGradesForUser(discussion, { _id: 'student1', role: 'student' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ grade: 8, feedback: 'Good post' });
    expect(resolveAssignmentGrade({ discussionGradeRow: visibility.discussionGradeForTotals(discussion, 'student1') })).toBe(8);
  });

  it('treats hidden mode as excluded from totals even if a grade exists', () => {
    const discussion = thread({ discussionReleaseMode: 'hidden', gradeHidden: true });
    expect(visibility.discussionGradeForTotals(discussion, 'student1')).toBeNull();
  });
});
