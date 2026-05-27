const gradeReleaseService = require('../../services/gradeRelease.service');
const timedQuiz = require('../../services/timedQuizAttempt.service');

describe('legacy assignment compatibility', () => {
  it('keeps old graded submissions visible by default unless a release policy hides them', () => {
    const legacyAssignment = { _id: 'a1', published: true };
    const legacySubmission = { _id: 's1', assignment: 'a1', grade: 87 };

    expect(gradeReleaseService.resolveStudentGradeVisibility(legacySubmission, legacyAssignment)).toMatchObject({
      mode: 'score_only',
      scoreVisible: true,
    });
  });

  it('reads old submissions without timed attempt fields as not-started attempts', () => {
    const legacyQuiz = { _id: 'quiz1', isTimedQuiz: true, quizTimeLimit: 10 };
    const legacySubmission = { _id: 'sub1', assignment: 'quiz1' };
    expect(timedQuiz.serializeAttempt(legacySubmission, legacyQuiz, new Date('2026-01-01T00:00:00.000Z'))).toMatchObject({
      submissionId: 'sub1',
      attemptStatus: 'not_started',
      remainingSeconds: null,
    });
  });

  it('does not let stale localStorage-style client time influence serialized deadlines', () => {
    const quiz = { _id: 'quiz1', isTimedQuiz: true, quizTimeLimit: 10 };
    const serverDeadline = new Date('2026-01-01T00:10:00.000Z');
    const submission = {
      _id: 'sub1',
      assignment: 'quiz1',
      attemptStatus: 'in_progress',
      attemptDeadlineAt: serverDeadline,
      localStorageDeadlineAt: new Date('2099-01-01T00:00:00.000Z'),
    };

    expect(timedQuiz.serializeAttempt(submission, quiz, new Date('2026-01-01T00:09:00.000Z'))).toMatchObject({
      attemptDeadlineAt: serverDeadline,
      remainingSeconds: 60,
    });
  });
});
