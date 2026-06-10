jest.mock('../../../models/course.model', () => ({
  find: jest.fn(),
}));

jest.mock('../../../models/module.model', () => ({
  find: jest.fn(),
}));

jest.mock('../../../models/Assignment', () => ({
  find: jest.fn(),
}));

jest.mock('../../../models/Submission', () => ({
  find: jest.fn(),
}));

jest.mock('../../../models/Group', () => ({
  find: jest.fn(),
}));

jest.mock('../../../models/thread.model', () => ({
  find: jest.fn(),
}));

jest.mock('../../../services/discussionReply.service', () => ({
  batchThreadIdsRepliedByUser: jest.fn(),
}));

jest.mock('../../../services/workflowObservability.service', () => ({
  metric: jest.fn(),
}));

const mongoose = require('mongoose');
const Course = require('../../../models/course.model');
const Module = require('../../../models/module.model');
const Assignment = require('../../../models/Assignment');
const Submission = require('../../../models/Submission');
const Group = require('../../../models/Group');
const Thread = require('../../../models/thread.model');
const discussionReplyService = require('../../../services/discussionReply.service');
const {
  getStudentDueAllItemsThisWeek,
  getStudentMissingAndOverdueAssignments,
  resolvePlannerMissingLookbackDays,
  buildMissingOverdueAssignmentFilter,
} = require('../../../services/planner/todoQuery.service');

function mockEnrolledContext({ courseId, moduleId, studentId }) {
  Course.find.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([{ _id: courseId, title: 'Math' }]),
  });
  Module.find.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([{ _id: moduleId, course: courseId }]),
  });
  Group.find.mockImplementation((query) => {
    if (query.course) {
      return {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
    }
    return {
      distinct: jest.fn().mockResolvedValue([]),
    };
  });
  Submission.find.mockReturnValue({
    distinct: jest.fn().mockResolvedValue([]),
  });
}

function chainFind(rows = []) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
}

describe('todoQuery.service phase11b sprint2', () => {
  const studentId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();
  const assignmentId = new mongoose.Types.ObjectId();
  const originalLookback = process.env.PLANNER_MISSING_LOOKBACK_DAYS;

  afterEach(() => {
    if (originalLookback == null) {
      delete process.env.PLANNER_MISSING_LOOKBACK_DAYS;
    } else {
      process.env.PLANNER_MISSING_LOOKBACK_DAYS = originalLookback;
    }
  });

  describe('resolvePlannerMissingLookbackDays', () => {
    it('defaults to 90 days', () => {
      delete process.env.PLANNER_MISSING_LOOKBACK_DAYS;
      expect(resolvePlannerMissingLookbackDays()).toBe(90);
    });

    it('parses valid env values', () => {
      process.env.PLANNER_MISSING_LOOKBACK_DAYS = '30';
      expect(resolvePlannerMissingLookbackDays()).toBe(30);
    });

    it('falls back to 90 for invalid env values', () => {
      process.env.PLANNER_MISSING_LOOKBACK_DAYS = 'not-a-number';
      expect(resolvePlannerMissingLookbackDays()).toBe(90);

      process.env.PLANNER_MISSING_LOOKBACK_DAYS = '0';
      expect(resolvePlannerMissingLookbackDays()).toBe(90);

      process.env.PLANNER_MISSING_LOOKBACK_DAYS = '-5';
      expect(resolvePlannerMissingLookbackDays()).toBe(90);
    });
  });

  describe('buildMissingOverdueAssignmentFilter', () => {
    it('applies lookback lower bound on dueDate', () => {
      const now = new Date('2026-05-28T12:00:00.000Z');
      process.env.PLANNER_MISSING_LOOKBACK_DAYS = '90';

      const filter = buildMissingOverdueAssignmentFilter(now);

      expect(filter.published).toBe(true);
      expect(filter.availableFrom).toEqual({ $lte: now });
      expect(filter.dueDate.$lt).toEqual(now);
      expect(filter.dueDate.$gte.getTime()).toBe(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    });
  });

  it('applies availableFrom filter to due-soon assignment queries', async () => {
    mockEnrolledContext({ courseId, moduleId, studentId });
    Assignment.find.mockImplementation(() => chainFind([]));
    Thread.find.mockReturnValue(chainFind([]));
    discussionReplyService.batchThreadIdsRepliedByUser.mockResolvedValue(new Set());

    await getStudentDueAllItemsThisWeek(studentId);

    expect(Assignment.find).toHaveBeenCalledWith(
      expect.objectContaining({
        availableFrom: { $lte: expect.any(Date) },
      })
    );
  });

  it('excludes assignments with future availableFrom from due-soon', async () => {
    mockEnrolledContext({ courseId, moduleId, studentId });
    Assignment.find.mockImplementation(() => chainFind([]));
    Thread.find.mockReturnValue(chainFind([]));
    discussionReplyService.batchThreadIdsRepliedByUser.mockResolvedValue(new Set());

    await getStudentDueAllItemsThisWeek(studentId);

    const filter = Assignment.find.mock.calls.find((call) => !call[0].isGroupAssignment)?.[0];
    expect(filter.availableFrom.$lte.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('applies lookback window to missing/overdue queries', async () => {
    process.env.PLANNER_MISSING_LOOKBACK_DAYS = '90';
    mockEnrolledContext({ courseId, moduleId, studentId });
    Assignment.find.mockImplementation(() => chainFind([]));

    await getStudentMissingAndOverdueAssignments(studentId);

    expect(Assignment.find).toHaveBeenCalledWith(
      expect.objectContaining({
        dueDate: expect.objectContaining({
          $lt: expect.any(Date),
          $gte: expect.any(Date),
        }),
        availableFrom: { $lte: expect.any(Date) },
      })
    );
  });

  it('excludes assignments older than lookback window from missing/overdue', async () => {
    process.env.PLANNER_MISSING_LOOKBACK_DAYS = '90';
    mockEnrolledContext({ courseId, moduleId, studentId });

    Assignment.find.mockImplementation((query) => {
      if (query.isGroupAssignment) return chainFind([]);
      const now = new Date();
      const lookbackStart = query.dueDate.$gte;
      const inWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const outOfWindow = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

      const rows = [];
      if (inWindow >= lookbackStart) {
        rows.push({
          _id: assignmentId,
          title: 'Recent Late',
          dueDate: inWindow,
          module: { course: { title: 'Math' } },
        });
      }
      if (outOfWindow >= lookbackStart) {
        rows.push({
          _id: new mongoose.Types.ObjectId(),
          title: 'Ancient Late',
          dueDate: outOfWindow,
          module: { course: { title: 'Math' } },
        });
      }

      return chainFind(rows);
    });

    const items = await getStudentMissingAndOverdueAssignments(studentId);

    expect(items.some((item) => item.title === 'Recent Late')).toBe(true);
    expect(items.some((item) => item.title === 'Ancient Late')).toBe(false);
  });
});
