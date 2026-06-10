jest.mock('../../../models/todo.model', () => ({
  find: jest.fn(),
}));

jest.mock('../../../services/planner/todoQuery.service', () => ({
  buildStudentPlannerContext: jest.fn(),
  getStudentDueAllItemsThisWeek: jest.fn(),
  getStudentMissingAndOverdueAssignments: jest.fn(),
  getTeacherUngradedTodoItems: jest.fn(),
}));

jest.mock('../../../services/notification/academicNotificationExpansion.service', () => ({
  isPlannerMissingAssignmentsEnabled: jest.fn(),
}));

jest.mock('../../../services/planner/plannerUxState.service', () => ({
  getActiveStateMapForUser: jest.fn().mockResolvedValue(new Map()),
  filterItemsByUxState: jest.fn((items) => items),
}));

jest.mock('../../../services/planner/plannerPriority.service', () => ({
  rankPlannerItems: jest.fn((items) => items),
  applyFeedCap: jest.fn((items) => ({
    items,
    capped: false,
    totalBeforeCap: items.length,
  })),
}));

jest.mock('../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

const todoQueryService = require('../../../services/planner/todoQuery.service');
const { isPlannerMissingAssignmentsEnabled } = require('../../../services/notification/academicNotificationExpansion.service');
const observability = require('../../../services/workflowObservability.service');
const {
  buildPlannerFeedForUser,
  resolvePlannerBranches,
} = require('../../../services/planner/plannerFeed.service');

describe('plannerFeed.service phase11b sprint3', () => {
  const userId = 'student-1';

  beforeEach(() => {
    jest.clearAllMocks();
    isPlannerMissingAssignmentsEnabled.mockReturnValue(true);
    todoQueryService.buildStudentPlannerContext.mockResolvedValue({
      courseIds: ['c1'],
      moduleIds: ['m1'],
      userGroupSetIds: [],
      submittedAssignmentIds: new Set(),
    });
  });

  it('loads shared planner context once for student feed', async () => {
    todoQueryService.getStudentDueAllItemsThisWeek.mockResolvedValue([
      { _id: 'a1', type: 'assignment', title: 'Due Soon' },
    ]);
    todoQueryService.getStudentMissingAndOverdueAssignments.mockResolvedValue([
      { _id: 'a2', type: 'assignment', title: 'Late', subType: 'missing' },
    ]);

    const Todo = require('../../../models/todo.model');
    Todo.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await buildPlannerFeedForUser(userId, 'student');

    expect(todoQueryService.buildStudentPlannerContext).toHaveBeenCalledTimes(1);
    expect(todoQueryService.getStudentDueAllItemsThisWeek).toHaveBeenCalledWith(userId, {
      plannerContext: expect.objectContaining({ courseIds: ['c1'] }),
    });
    expect(todoQueryService.getStudentMissingAndOverdueAssignments).toHaveBeenCalledWith(userId, {
      plannerContext: expect.objectContaining({ courseIds: ['c1'] }),
    });
  });

  it('returns partial feed when due-soon fails but missing/overdue succeeds', async () => {
    todoQueryService.getStudentDueAllItemsThisWeek.mockRejectedValue(new Error('due-soon down'));
    todoQueryService.getStudentMissingAndOverdueAssignments.mockResolvedValue([
      { _id: 'a2', type: 'assignment', title: 'Late', subType: 'overdue' },
    ]);

    const Todo = require('../../../models/todo.model');
    Todo.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const feed = await buildPlannerFeedForUser(userId, 'student');

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]).toMatchObject({ title: 'Late', subType: 'overdue' });
    expect(observability.metric).toHaveBeenCalledWith(
      'planner_branch_failed',
      expect.objectContaining({ branch: 'due_soon' })
    );
  });

  it('returns partial feed when personal todos fail', async () => {
    todoQueryService.getStudentDueAllItemsThisWeek.mockResolvedValue([
      { _id: 'a1', type: 'assignment', title: 'Due Soon' },
    ]);
    todoQueryService.getStudentMissingAndOverdueAssignments.mockResolvedValue([]);

    const Todo = require('../../../models/todo.model');
    Todo.find.mockReturnValue({
      sort: jest.fn().mockImplementation(() => {
        throw new Error('todo db error');
      }),
    });

    const feed = await buildPlannerFeedForUser(userId, 'student');

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]).toMatchObject({ title: 'Due Soon' });
    expect(observability.metric).toHaveBeenCalledWith(
      'planner_branch_failed',
      expect.objectContaining({ branch: 'personal' })
    );
  });

  it('throws only when all planner branches fail', async () => {
    todoQueryService.getStudentDueAllItemsThisWeek.mockRejectedValue(new Error('due-soon down'));
    todoQueryService.getStudentMissingAndOverdueAssignments.mockRejectedValue(
      new Error('missing down')
    );

    const Todo = require('../../../models/todo.model');
    Todo.find.mockReturnValue({
      sort: jest.fn().mockImplementation(() => {
        throw new Error('todo db error');
      }),
    });

    await expect(buildPlannerFeedForUser(userId, 'student')).rejects.toThrow('due-soon down');
  });

  describe('resolvePlannerBranches', () => {
    it('uses fallback values for failed branches', async () => {
      const { values, failures } = await resolvePlannerBranches([
        { name: 'ok', run: async () => ['item'] },
        { name: 'bad', run: async () => Promise.reject(new Error('branch failed')) },
      ]);

      expect(values).toEqual([['item'], []]);
      expect(failures).toHaveLength(1);
      expect(failures[0].branch).toBe('bad');
    });
  });
});
