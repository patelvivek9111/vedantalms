jest.mock('../../services/assignmentAccess.service', () => ({
  assertStudentCanSubmitAssignment: jest.fn(),
  assertStudentCanViewAssignment: jest.fn(),
}));
jest.mock('../../models/Submission', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../models/Group', () => ({ findById: jest.fn() }));

const Submission = require('../../models/Submission');
const timedQuiz = require('../../services/timedQuizAttempt.service');

describe('submission race hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('manual submit and sweep use the same terminal-state guard', async () => {
    const user = { _id: 'student1' };
    const assignment = { _id: 'quiz1', isTimedQuiz: true, quizTimeLimit: 5 };
    const deadline = new Date('2026-01-01T00:05:00.000Z');

    Submission.findOneAndUpdate.mockResolvedValueOnce({
      _id: 'sub1',
      assignment: 'quiz1',
      student: 'student1',
      attemptStatus: 'submitted',
      attemptDeadlineAt: deadline,
    });
    await timedQuiz.transitionTimedQuizToSubmitted(user, assignment, {
      now: new Date('2026-01-01T00:04:59.000Z'),
      answers: { 0: 'A' },
    });

    const updateFilter = Submission.findOneAndUpdate.mock.calls[0][0];
    expect(updateFilter).toMatchObject({
      assignment: 'quiz1',
      student: 'student1',
      attemptStatus: 'in_progress',
      attemptDeadlineAt: { $gte: new Date('2026-01-01T00:04:59.000Z') },
    });
  });

  it('retry after timeout reports already-closed instead of creating another terminal state', async () => {
    const user = { _id: 'student1' };
    const assignment = { _id: 'quiz1', isTimedQuiz: true, quizTimeLimit: 5 };
    Submission.findOneAndUpdate.mockResolvedValue(null);
    Submission.findOne.mockResolvedValue({
      _id: 'sub1',
      assignment: 'quiz1',
      student: 'student1',
      attemptStatus: 'submitted',
      submittedAt: new Date('2026-01-01T00:05:00.000Z'),
    });

    await expect(timedQuiz.transitionTimedQuizToSubmitted(user, assignment, {
      now: new Date('2026-01-01T00:05:01.000Z'),
    })).rejects.toMatchObject({ code: 'QUIZ_ATTEMPT_CLOSED' });
  });
});
