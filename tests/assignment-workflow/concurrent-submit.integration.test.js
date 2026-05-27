jest.mock('../../services/assignmentAccess.service', () => ({
  assertStudentCanSubmitAssignment: jest.fn(),
  assertStudentCanViewAssignment: jest.fn(),
}));
jest.mock('../../models/Submission', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../models/Group', () => ({ findById: jest.fn() }));

const Submission = require('../../models/Submission');
const timedQuiz = require('../../services/timedQuizAttempt.service');

describe('concurrent submit atomicity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses a conditional terminal transition for manual timed quiz submit', async () => {
    const user = { _id: 'student1', role: 'student' };
    const assignment = { _id: 'quiz1', isTimedQuiz: true, quizTimeLimit: 10 };
    const now = new Date('2026-01-01T00:09:00.000Z');
    Submission.findOneAndUpdate.mockResolvedValue({
      _id: 'sub1',
      assignment: 'quiz1',
      student: 'student1',
      attemptStatus: 'submitted',
      submittedAt: now,
    });

    await timedQuiz.transitionTimedQuizToSubmitted(user, assignment, { now, answers: { 0: 'A' } });

    expect(Submission.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment: 'quiz1',
        student: 'student1',
        attemptStatus: 'in_progress',
        attemptDeadlineAt: { $gte: now },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          attemptStatus: 'submitted',
          submittedAt: now,
          answers: { 0: 'A' },
        }),
      }),
      { new: true }
    );
  });

  it('sweep and manual submit collision results in one winner', async () => {
    const now = new Date('2026-01-01T00:10:00.000Z');
    const expired = [{ _id: 'sub1', assignment: 'quiz1', attemptDeadlineAt: now }];
    Submission.find
      .mockReturnValueOnce({ sort: () => ({ limit: () => Promise.resolve(expired) }) })
      .mockReturnValueOnce({ sort: () => ({ limit: () => Promise.resolve([]) }) });
    Submission.findOneAndUpdate.mockResolvedValueOnce(null);

    const result = await timedQuiz.sweepExpiredTimedQuizAttempts({ now, limit: 1 });

    expect(result.submittedCount).toBe(0);
    expect(Submission.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'sub1', attemptStatus: 'in_progress' },
      expect.any(Object),
      { new: true }
    );
  });
});
