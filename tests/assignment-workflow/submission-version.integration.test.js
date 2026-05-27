jest.mock('../../models/submissionVersion.model', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
}));

const SubmissionVersion = require('../../models/submissionVersion.model');
const versionService = require('../../services/submissionVersion.service');

describe('submission version integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates exactly one immutable snapshot before a meaningful overwrite', async () => {
    SubmissionVersion.findOne.mockReturnValue({
      sort: () => ({ select: () => ({ lean: () => Promise.resolve({ version: 2 }) }) }),
    });
    SubmissionVersion.create.mockResolvedValue({ version: 3 });

    const result = await versionService.snapshotSubmission({
      _id: 'sub1',
      assignment: 'a1',
      student: 'student1',
      answers: new Map([['0', 'A']]),
      files: ['/api/files/file1'],
      fileAssets: ['file1'],
      submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      submittedBy: 'student1',
      autoGraded: true,
      autoGrade: 10,
      autoQuestionGrades: new Map([['0', 10]]),
    }, { actorId: 'student1' });

    expect(result).toEqual({ version: 3 });
    expect(SubmissionVersion.create).toHaveBeenCalledTimes(1);
    expect(SubmissionVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      submission: 'sub1',
      version: 3,
      answers: { 0: 'A' },
      files: ['/api/files/file1'],
      fileAssets: ['file1'],
      autoGradeSnapshot: expect.objectContaining({ autoGrade: 10 }),
    }));
  });

  it('does not snapshot empty timed-quiz shells before first submit', async () => {
    const result = await versionService.snapshotSubmission({
      _id: 'sub1',
      assignment: 'a1',
      student: 'student1',
      answers: {},
      files: [],
      fileAssets: [],
    }, { actorId: 'student1' });

    expect(result).toBeNull();
    expect(SubmissionVersion.create).not.toHaveBeenCalled();
  });

  it('paginates version history reads', async () => {
    const limit = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ version: 5 }]) });
    const sort = jest.fn().mockReturnValue({ limit });
    SubmissionVersion.find.mockReturnValue({ sort });

    const result = await versionService.listSubmissionVersions('sub1', { limit: 10, beforeVersion: 6 });
    expect(SubmissionVersion.find).toHaveBeenCalledWith({ submission: 'sub1', version: { $lt: 6 } });
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toEqual([{ version: 5 }]);
  });
});
