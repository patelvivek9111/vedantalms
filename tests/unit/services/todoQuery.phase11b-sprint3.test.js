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
  buildStudentPlannerContext,
  getStudentDueAllItemsThisWeek,
  getStudentMissingAndOverdueAssignments,
  getStudentSubmittedAssignmentIds,
} = require('../../../services/planner/todoQuery.service');

function chainFind(rows = []) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
}

describe('todoQuery.service phase11b sprint3', () => {
  const studentId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildStudentPlannerContext loads enrollment and submissions once', async () => {
    Course.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: courseId, title: 'Math' }]),
    });
    Module.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: moduleId, course: courseId }]),
    });
    Group.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: new mongoose.Types.ObjectId(), groupSet: new mongoose.Types.ObjectId(), course: courseId },
      ]),
    });
    Submission.find.mockReturnValue({
      distinct: jest.fn().mockResolvedValue([]),
    });

    const ctx = await buildStudentPlannerContext(studentId);

    expect(ctx).toMatchObject({
      courseIds: [courseId],
      moduleIds: [moduleId],
    });
    expect(ctx.submittedAssignmentIds).toBeInstanceOf(Set);
    expect(Course.find).toHaveBeenCalledTimes(1);
    expect(Module.find).toHaveBeenCalledTimes(1);
    expect(Group.find).toHaveBeenCalledTimes(1);
  });

  it('reuses shared planner context without reloading enrollment or submissions', async () => {
    const sharedContext = {
      courses: [{ _id: courseId, title: 'Math' }],
      courseIds: [courseId],
      modules: [{ _id: moduleId, course: courseId }],
      moduleIds: [moduleId],
      userGroups: [],
      userGroupSetIds: [],
      submittedAssignmentIds: new Set(),
    };

    Assignment.find.mockImplementation(() => chainFind([]));
    Thread.find.mockReturnValue(chainFind([]));
    discussionReplyService.batchThreadIdsRepliedByUser.mockResolvedValue(new Set());

    await Promise.all([
      getStudentDueAllItemsThisWeek(studentId, { plannerContext: sharedContext }),
      getStudentMissingAndOverdueAssignments(studentId, { plannerContext: sharedContext }),
    ]);

    expect(Course.find).not.toHaveBeenCalled();
    expect(Module.find).not.toHaveBeenCalled();
    expect(Group.find).not.toHaveBeenCalled();
    expect(Submission.find).not.toHaveBeenCalled();
  });

  it('reuses userGroups for submission lookup when provided', async () => {
    const groupId = new mongoose.Types.ObjectId();
    Submission.find.mockReturnValue({
      distinct: jest.fn().mockResolvedValue([]),
    });

    await getStudentSubmittedAssignmentIds(studentId, {
      userGroups: [{ _id: groupId }],
    });

    expect(Group.find).not.toHaveBeenCalled();
    expect(Submission.find).toHaveBeenCalledTimes(2);
  });
});
