jest.mock('../../services/assignmentAccess.service', () => ({
  assertStudentCanSubmitAssignment: jest.fn(),
  assertStudentCanViewAssignment: jest.fn(),
}));
jest.mock('../../models/Submission', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../../models/Group', () => ({ findById: jest.fn() }));

const assignmentAccess = require('../../services/assignmentAccess.service');
const Submission = require('../../models/Submission');
const timedQuiz = require('../../services/timedQuizAttempt.service');

const user = { _id: 'student1', role: 'student' };
const assignment = {
  _id: 'quiz1',
  isTimedQuiz: true,
  quizTimeLimit: 10,
  isGroupAssignment: false,
  dueDate: new Date('2026-01-02T00:00:00.000Z'),
};

describe('timed quiz server authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assignmentAccess.assertStudentCanSubmitAssignment.mockResolvedValue({ assignment });
    assignmentAccess.assertStudentCanViewAssignment.mockResolvedValue({ assignment });
  });

  it('creates a server-computed deadline on start and resumes existing attempts idempotently', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    Submission.findOne.mockResolvedValue(null);
    Submission.findOneAndUpdate.mockResolvedValue({
      _id: 'sub1',
      assignment: 'quiz1',
      attemptStartedAt: now,
      attemptDeadlineAt: new Date('2026-01-01T00:10:00.000Z'),
      attemptStatus: 'in_progress',
    });

    const attempt = await timedQuiz.startTimedQuizAttempt(user, 'quiz1', { now });
    expect(attempt.remainingSeconds).toBe(600);
    expect(Submission.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ assignment: assignment._id, student: user._id }),
      expect.objectContaining({
        $set: expect.objectContaining({
          attemptDeadlineAt: new Date('2026-01-01T00:10:00.000Z'),
          attemptStatus: 'in_progress',
        }),
      }),
      expect.objectContaining({ upsert: true })
    );

    Submission.findOne.mockResolvedValue({
      _id: 'sub1',
      attemptStartedAt: now,
      attemptDeadlineAt: new Date('2026-01-01T00:10:00.000Z'),
      attemptStatus: 'in_progress',
    });
    const resumed = await timedQuiz.startTimedQuizAttempt(user, 'quiz1', {
      now: new Date('2026-01-01T00:05:00.000Z'),
    });
    expect(resumed.remainingSeconds).toBe(300);
  });

  it('uses atomic transition so duplicate submits cannot both close the same attempt', async () => {
    const now = new Date('2026-01-01T00:09:00.000Z');
    Submission.findOneAndUpdate
      .mockResolvedValueOnce({ _id: 'sub1', attemptStatus: 'submitted', attemptDeadlineAt: new Date('2026-01-01T00:10:00.000Z') })
      .mockResolvedValueOnce(null);
    Submission.findOne.mockResolvedValue({ _id: 'sub1', attemptStatus: 'submitted', attemptDeadlineAt: new Date('2026-01-01T00:10:00.000Z') });

    await expect(timedQuiz.transitionTimedQuizToSubmitted(user, assignment, { now, answers: { 0: 'A' } })).resolves.toMatchObject({
      _id: 'sub1',
    });
    await expect(timedQuiz.transitionTimedQuizToSubmitted(user, assignment, { now, answers: { 0: 'A' } })).rejects.toMatchObject({
      code: 'QUIZ_ATTEMPT_CLOSED',
    });
  });

  it('sweeps expired attempts in batches and is retry-safe', async () => {
    const expired = [
      { _id: 'sub1', assignment: 'quiz1', attemptDeadlineAt: new Date('2026-01-01T00:10:00.000Z') },
      { _id: 'sub2', assignment: 'quiz1', attemptDeadlineAt: new Date('2026-01-01T00:11:00.000Z') },
    ];
    const secondBatch = [];
    Submission.find
      .mockReturnValueOnce({ sort: () => ({ limit: () => Promise.resolve(expired) }) })
      .mockReturnValueOnce({ sort: () => ({ limit: () => Promise.resolve(secondBatch) }) });
    Submission.findOneAndUpdate.mockResolvedValue({ _id: 'updated' });

    const result = await timedQuiz.sweepExpiredTimedQuizAttempts({
      limit: 2,
      now: new Date('2026-01-01T00:12:00.000Z'),
    });
    expect(result).toMatchObject({ submittedCount: 2, scannedCount: 2, failedCount: 0 });
    expect(Submission.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
});
