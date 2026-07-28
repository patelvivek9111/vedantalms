jest.mock('../../../models/rubric.model', () => {
  const lean = jest.fn();
  const limit = jest.fn(() => ({ lean }));
  const sort = jest.fn(() => ({ limit }));
  const find = jest.fn(() => ({ sort }));
  const findOne = jest.fn();
  return { find, findOne, __lean: lean, __find: find, __findOne: findOne };
});

jest.mock('../../../models/Assignment', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  find: jest.fn(() => ({
    select: jest.fn(() => ({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue([]),
        })),
      })),
    })),
  })),
  aggregate: jest.fn().mockResolvedValue([]),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
}));

jest.mock('../../../models/Submission', () => ({
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
}));

jest.mock('../../../utils/tenantContext', () => ({
  withTenantFilter: (filter, root) => ({ ...filter, rootAccountId: root }),
  rootAccountIdFromRequest: () => 'tenant1',
}));

const Rubric = require('../../../models/rubric.model');
const Assignment = require('../../../models/Assignment');
const Submission = require('../../../models/Submission');
const {
  listRubrics,
  rubricBankScope,
  toSnapshot,
  updateRubric,
  deleteRubric,
} = require('../../../services/rubric.service');

describe('rubric bank (Phase 4 + Canvas safeguards)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Rubric.__lean.mockResolvedValue([
      {
        _id: 'r1',
        title: 'Essay rubric',
        courseId: 'course1',
        criteria: [{ id: 'c1', description: 'Clarity', points: 5, ratings: [] }],
        pointsPossible: 5,
      },
      {
        _id: 'r2',
        title: 'Institution writing',
        courseId: null,
        criteria: [{ id: 'c1', description: 'Voice', points: 4, ratings: [] }],
        pointsPossible: 4,
      },
    ]);
    Assignment.aggregate.mockResolvedValue([{ _id: 'r1', count: 2 }]);
    Assignment.countDocuments.mockResolvedValue(0);
  });

  it('annotates course vs account scope', () => {
    expect(rubricBankScope({ courseId: 'abc' })).toBe('course');
    expect(rubricBankScope({ courseId: null })).toBe('account');
  });

  it('lists course + account bank with association counts', async () => {
    const rows = await listRubrics({
      courseId: 'course1',
      user: { rootAccountId: 'tenant1' },
      req: {},
    });
    expect(rows.find((r) => r._id === 'r1').associationCount).toBe(2);
    expect(rows.find((r) => r._id === 'r2').associationCount).toBe(0);
  });

  it('blocks in-place edit when attached to multiple assignments', async () => {
    Rubric.__findOne.mockResolvedValue({
      _id: 'r1',
      title: 'Essay',
      courseId: 'course1',
      criteria: [],
      save: jest.fn(),
    });
    Assignment.countDocuments.mockResolvedValue(3);

    await expect(
      updateRubric(
        'r1',
        { title: 'Renamed', criteria: [{ id: 'c1', description: 'A', points: 1, ratings: [] }] },
        { user: { rootAccountId: 'tenant1', role: 'teacher' }, req: {} }
      )
    ).rejects.toMatchObject({
      status: 409,
      code: 'RUBRIC_IN_USE_COPY_REQUIRED',
    });
  });

  it('forbids teachers from deleting institution rubrics', async () => {
    Rubric.__findOne.mockResolvedValue({
      _id: 'r2',
      title: 'Institution',
      courseId: null,
      save: jest.fn(),
    });

    await expect(
      deleteRubric('r2', { user: { role: 'teacher', rootAccountId: 'tenant1' }, req: {} })
    ).rejects.toMatchObject({
      status: 403,
      code: 'RUBRIC_ACCOUNT_DELETE_FORBIDDEN',
    });
  });

  it('cascade-detaches assignments and clears assessments on delete', async () => {
    const save = jest.fn();
    Rubric.__findOne.mockResolvedValue({
      _id: 'r1',
      title: 'Essay',
      courseId: 'course1',
      workflowState: 'active',
      save,
    });
    Assignment.find.mockReturnValue({
      select: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([{ _id: 'a1' }, { _id: 'a2' }]),
      })),
    });

    const result = await deleteRubric('r1', {
      user: { role: 'teacher', rootAccountId: 'tenant1' },
      req: {},
    });

    expect(Assignment.updateMany).toHaveBeenCalled();
    expect(Submission.updateMany).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(result.detachedAssignmentCount).toBe(2);
    expect(result.workflowState).toBe('deleted');
  });

  it('toSnapshot keeps bank rubricId for assignment attach', () => {
    const snap = toSnapshot({
      _id: 'bank1',
      title: 'Bank',
      criteria: [
        {
          id: 'c1',
          description: 'A',
          points: 2,
          ratings: [{ id: 'r1', description: 'Full', points: 2 }],
        },
      ],
    });
    expect(snap.rubricId).toBe('bank1');
    expect(snap.pointsPossible).toBe(2);
  });
});
