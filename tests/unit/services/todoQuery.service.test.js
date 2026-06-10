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
  aggregate: jest.fn(),
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
const observability = require('../../../services/workflowObservability.service');
const {
  getTeacherUngradedTodoItems,
  getStudentDueAllItemsThisWeek,
  getStudentMissingAndOverdueAssignments,
} = require('../../../services/planner/todoQuery.service');

function mockEnrolledContext({ courseId, moduleId, studentId, userGroupSetIds = [] }) {
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
        lean: jest.fn().mockResolvedValue(
          userGroupSetIds.map((gsId) => ({
            _id: new mongoose.Types.ObjectId(),
            groupSet: gsId,
            course: courseId,
          }))
        ),
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

describe('todoQuery.service', () => {
  const instructorId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();
  const otherCourseId = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();
  const assignmentId = new mongoose.Types.ObjectId();
  const groupSetId = new mongoose.Types.ObjectId();
  const groupAssignmentId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates ungraded counts in bulk for teacher todo', async () => {
    Course.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: courseId, title: 'Math' }]),
    });
    Module.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: moduleId, course: courseId }]),
    });
    Assignment.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: assignmentId, title: 'HW1', module: moduleId },
      ]),
    });
    Submission.aggregate.mockResolvedValue([
      { _id: assignmentId, ungradedCount: 4 },
    ]);

    const results = await getTeacherUngradedTodoItems(instructorId);

    expect(Submission.aggregate).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      {
        id: assignmentId,
        title: 'HW1',
        course: { id: courseId, title: 'Math' },
        ungradedCount: 4,
      },
    ]);
    expect(observability.metric).toHaveBeenCalledWith(
      'todo_query_completed',
      expect.objectContaining({ endpoint: 'teacher_ungraded', queryCount: 4 })
    );
  });

  it('returns enrolled due-soon assignments only', async () => {
    const dueDate = new Date();
    mockEnrolledContext({ courseId, moduleId, studentId });

    let assignmentCall = 0;
    Assignment.find.mockImplementation((query) => {
      assignmentCall += 1;
      if (query.isGroupAssignment) {
        return chainFind([]);
      }
      return chainFind([
        {
          _id: assignmentId,
          title: 'Enrolled HW',
          dueDate,
          module: { course: { title: 'Math' } },
        },
      ]);
    });

    Thread.find.mockReturnValue(chainFind([]));
    discussionReplyService.batchThreadIdsRepliedByUser.mockResolvedValue(new Set());

    const items = await getStudentDueAllItemsThisWeek(studentId);

    expect(Course.find).toHaveBeenCalledWith(
      expect.objectContaining({ students: studentId, published: true })
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'assignment',
      title: 'Enrolled HW',
    });
  });

  it('excludes assignments outside enrolled courses from due-soon feed', async () => {
    mockEnrolledContext({ courseId, moduleId, studentId });

    Assignment.find.mockImplementation((query) => {
      if (query.isGroupAssignment) return chainFind([]);
      return chainFind([]);
    });
    Thread.find.mockReturnValue(chainFind([]));
    discussionReplyService.batchThreadIdsRepliedByUser.mockResolvedValue(new Set());

    const items = await getStudentDueAllItemsThisWeek(studentId);

    expect(items).toHaveLength(0);
    expect(Assignment.find).toHaveBeenCalledWith(
      expect.objectContaining({ module: { $in: [moduleId] } })
    );
  });

  it('batch-filters discussions for student due-all', async () => {
    const threadId = new mongoose.Types.ObjectId();
    const dueDate = new Date();
    mockEnrolledContext({ courseId, moduleId, studentId });

    Assignment.find.mockImplementation((query) => {
      if (query.isGroupAssignment) return chainFind([]);
      return chainFind([]);
    });
    Thread.find.mockReturnValue(
      chainFind([
        {
          _id: threadId,
          title: 'Discuss',
          dueDate,
          module: { course: { title: 'Science' } },
        },
      ])
    );
    discussionReplyService.batchThreadIdsRepliedByUser.mockResolvedValue(new Set());

    const items = await getStudentDueAllItemsThisWeek(studentId);

    expect(Thread.find).toHaveBeenCalledWith(
      expect.objectContaining({ course: { $in: [courseId] } })
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'discussion',
      itemType: 'Discussion',
      title: 'Discuss',
    });
  });

  it('returns missing and overdue module assignments for enrolled student courses', async () => {
    const pastDue = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const longOverdue = new Date(Date.now() - 48 * 60 * 60 * 1000);
    mockEnrolledContext({ courseId, moduleId, studentId });

    Assignment.find.mockImplementation((query) => {
      if (query.isGroupAssignment) return chainFind([]);
      return chainFind([
        {
          _id: assignmentId,
          title: 'Late HW',
          dueDate: pastDue,
          module: { course: { title: 'Math' } },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Very Late HW',
          dueDate: longOverdue,
          module: { course: { title: 'Math' } },
        },
      ]);
    });

    const items = await getStudentMissingAndOverdueAssignments(studentId);

    expect(items).toHaveLength(2);
    expect(items.find((item) => item.title === 'Late HW').subType).toBe('missing');
    expect(items.find((item) => item.title === 'Very Late HW').subType).toBe('overdue');
  });

  it('includes missing group assignments for enrolled group members', async () => {
    const pastDue = new Date(Date.now() - 48 * 60 * 60 * 1000);
    mockEnrolledContext({ courseId, moduleId, studentId, userGroupSetIds: [groupSetId] });

    Assignment.find.mockImplementation((query) => {
      if (query.isGroupAssignment) {
        return chainFind([
          {
            _id: groupAssignmentId,
            title: 'Group Project',
            dueDate: pastDue,
            isGroupAssignment: true,
            groupSet: { _id: groupSetId, course: { title: 'Math' } },
          },
        ]);
      }
      return chainFind([]);
    });

    const items = await getStudentMissingAndOverdueAssignments(studentId);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Group Project',
      subType: 'overdue',
      type: 'assignment',
    });
  });

  it('excludes submitted group assignments from missing/overdue', async () => {
    const pastDue = new Date(Date.now() - 48 * 60 * 60 * 1000);
    mockEnrolledContext({ courseId, moduleId, studentId, userGroupSetIds: [groupSetId] });

    Assignment.find.mockImplementation((query) => {
      if (query.isGroupAssignment) {
        return chainFind([
          {
            _id: groupAssignmentId,
            title: 'Group Project',
            dueDate: pastDue,
            isGroupAssignment: true,
            groupSet: { _id: groupSetId, course: { title: 'Math' } },
          },
        ]);
      }
      return chainFind([]);
    });

    Submission.find.mockImplementation((query) => {
      if (query.group) {
        return { distinct: jest.fn().mockResolvedValue([groupAssignmentId]) };
      }
      return { distinct: jest.fn().mockResolvedValue([]) };
    });
    Group.find.mockImplementation((query) => {
      if (query.course) {
        return {
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([
            {
              _id: new mongoose.Types.ObjectId(),
              groupSet: groupSetId,
              course: courseId,
            },
          ]),
        };
      }
      return {
        distinct: jest.fn().mockResolvedValue([new mongoose.Types.ObjectId()]),
      };
    });

    const items = await getStudentMissingAndOverdueAssignments(studentId);

    expect(items).toHaveLength(0);
  });
});
