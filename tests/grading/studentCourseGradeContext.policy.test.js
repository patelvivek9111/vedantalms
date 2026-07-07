/**
 * Phase 8 — grade context builder uses batched queries (no N+1 per group assignment or discussion).
 */
jest.mock('../../models/module.model', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/Assignment', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/Submission', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/thread.model', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/Group', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../models/GroupSet', () => ({
  find: jest.fn(),
}));

jest.mock('../../services/discussionReply.service', () => ({
  batchThreadIdsRepliedByUser: jest.fn(),
  batchFirstReplyCreatedAtByUser: jest.fn(),
  hasReplyByUser: jest.fn(),
}));

jest.mock('../../services/gradeRelease.service', () => ({
  resolveStudentGradeVisibility: jest.fn().mockReturnValue({ scoreVisible: true }),
}));

jest.mock('../../services/discussionGradeVisibility.service', () => ({
  discussionGradeForTotals: jest.fn().mockReturnValue(null),
  findStudentGrade: jest.fn().mockReturnValue(null),
  resolveDiscussionGradeVisibility: jest.fn().mockReturnValue({ scoreVisible: true }),
}));

jest.mock('../../utils/gradeCalculation', () => ({
  resolveAssignmentGrade: jest.fn().mockReturnValue(null),
  buildGradesMapForStudent: jest.fn(),
}));

const mongoose = require('mongoose');
const Module = require('../../models/module.model');
const Assignment = require('../../models/Assignment');
const Submission = require('../../models/Submission');
const Thread = require('../../models/thread.model');
const Group = require('../../models/Group');
const GroupSet = require('../../models/GroupSet');
const discussionReplyService = require('../../services/discussionReply.service');
const {
  buildStudentCourseGradeContext,
  loadGroupSubmissionsForStudent,
} = require('../../services/studentCourseGradeData.service');

function chainLean(value) {
  const lean = jest.fn().mockResolvedValue(value);
  const select = jest.fn().mockReturnValue({ lean });
  return { select, lean };
}

describe('studentCourseGradeData.service (Phase 8 batching)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loadGroupSubmissionsForStudent uses batched Group.find + Submission.find (not findOne per assignment)', async () => {
    const gsId = new mongoose.Types.ObjectId();
    const groupId = new mongoose.Types.ObjectId();
    const a1 = new mongoose.Types.ObjectId();
    const a2 = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();

    Group.find.mockReturnValue(
      chainLean([{ _id: groupId, groupSet: gsId }])
    );
    Submission.find.mockReturnValue(
      chainLean([
        { assignment: a1, group: groupId, _id: 'sub1' },
        { assignment: a2, group: groupId, _id: 'sub2' },
      ])
    );

    const groupAssignments = [
      { _id: a1, groupSet: gsId },
      { _id: a2, groupSet: gsId },
      { _id: new mongoose.Types.ObjectId(), groupSet: gsId },
    ];

    const subs = await loadGroupSubmissionsForStudent(groupAssignments, studentId);

    expect(Group.findOne).not.toHaveBeenCalled();
    expect(Group.find).toHaveBeenCalledTimes(1);
    expect(Submission.find).toHaveBeenCalledTimes(1);
    expect(subs).toHaveLength(2);
  });

  it('buildStudentCourseGradeContext batches discussion reply checks', async () => {
    const courseId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const moduleId = new mongoose.Types.ObjectId();
    const threadId = new mongoose.Types.ObjectId();

    Module.find.mockReturnValue(chainLean([{ _id: moduleId }]));
    GroupSet.find.mockReturnValue(chainLean([]));
    Assignment.find.mockReturnValue(chainLean([]));
    Thread.find.mockReturnValue(
      chainLean([
        { _id: threadId, title: 'T1', group: 'Discussions', totalPoints: 10, published: true },
        { _id: new mongoose.Types.ObjectId(), title: 'T2', group: 'Discussions', totalPoints: 5 },
      ])
    );
    Submission.find.mockReturnValue(chainLean([]));
    discussionReplyService.batchThreadIdsRepliedByUser.mockResolvedValue(new Set([String(threadId)]));
    discussionReplyService.batchFirstReplyCreatedAtByUser.mockResolvedValue(new Map());

    await buildStudentCourseGradeContext({ _id: courseId }, studentId);

    expect(discussionReplyService.batchThreadIdsRepliedByUser).toHaveBeenCalledTimes(1);
    expect(discussionReplyService.batchFirstReplyCreatedAtByUser).toHaveBeenCalledTimes(1);
    expect(discussionReplyService.hasReplyByUser).not.toHaveBeenCalled();
  });
});
