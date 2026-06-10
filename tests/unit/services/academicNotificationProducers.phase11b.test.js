jest.mock('../../../models/course.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/module.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/GroupSet', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/user.model', () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../../../services/notification/courseEnrollmentRecipients.service', () => ({
  filterToActiveCourseStudentIds: jest.fn(async (ids) =>
    (ids || []).map((id) => String(id._id || id))
  ),
  isActiveCourseStudent: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../services/discussionAccess.service', () => ({
  resolveDiscussionStudentRecipientIds: jest.fn(),
  resolveCourseStaffRecipientIds: jest.fn(),
  isCourseStaff: jest.fn(),
}));

jest.mock('../../../services/discussionWorkflow.service', () => ({
  isDiscussionPublished: jest.fn(),
}));

jest.mock('../../../services/discussionGradeVisibility.service', () => ({
  findStudentGrade: jest.fn(),
  resolveDiscussionGradeVisibility: jest.fn(),
}));

jest.mock('../../../services/domain/createNotificationFromDomainEvent', () => ({
  createNotificationFromDomainEvent: jest.fn(),
}));

jest.mock('../../../services/notification/academicNotificationExpansion.service', () => ({
  fanoutAcademicDomainNotifications: jest.fn(),
  resolveCourseStudentIds: jest.fn(),
  normalizeObjectIdString: jest.requireActual(
    '../../../services/notification/academicNotificationExpansion.service'
  ).normalizeObjectIdString,
  isAcademicNotificationExpansionEnabled: jest.fn().mockReturnValue(true),
  buildAcademicEventWindow: jest.fn().mockReturnValue('window'),
}));

const mongoose = require('mongoose');
const GroupSet = require('../../../models/GroupSet');
const Module = require('../../../models/module.model');
const User = require('../../../models/user.model');
const discussionAccess = require('../../../services/discussionAccess.service');
const discussionWorkflow = require('../../../services/discussionWorkflow.service');
const discussionGradeVisibility = require('../../../services/discussionGradeVisibility.service');
const { createNotificationFromDomainEvent } = require('../../../services/domain/createNotificationFromDomainEvent');
const {
  fanoutAcademicDomainNotifications,
  resolveCourseStudentIds,
  buildAcademicEventWindow,
} = require('../../../services/notification/academicNotificationExpansion.service');
const {
  notifyAssignmentCreated,
  notifyAssignmentUpdated,
  notifyAssignmentPublished,
  notifyDiscussionCreated,
  notifyDiscussionReplyPosted,
  notifyDiscussionGraded,
  notifyGradesAmended,
  resolveCourseFromAssignment,
} = require('../../../services/notification/academicNotificationProducers.service');

describe('academicNotificationProducers.service phase11b', () => {
  const courseId = new mongoose.Types.ObjectId();
  const assignmentId = new mongoose.Types.ObjectId();
  const groupSetId = new mongoose.Types.ObjectId();
  const studentA = new mongoose.Types.ObjectId();
  const studentB = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const taId = new mongoose.Types.ObjectId();
  const threadId = new mongoose.Types.ObjectId();

  const course = {
    _id: courseId,
    title: 'Biology',
    students: [studentA, studentB],
    instructor: actorId,
    admins: [adminId],
    teachingAssistants: [taId],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveCourseStudentIds.mockImplementation(async (c) =>
      (c?.students || []).map((id) => String(id._id || id))
    );
    discussionAccess.resolveDiscussionStudentRecipientIds.mockResolvedValue([String(studentA)]);
    discussionAccess.resolveCourseStaffRecipientIds.mockReturnValue([
      String(actorId),
      String(adminId),
      String(taId),
    ]);
    discussionAccess.isCourseStaff.mockReturnValue(true);
    discussionWorkflow.isDiscussionPublished.mockReturnValue(true);
    fanoutAcademicDomainNotifications.mockResolvedValue({ delivered: 1 });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ role: 'teacher' }),
    });
  });

  describe('group assignment course resolution', () => {
    it('resolves course via groupSet when module is absent', async () => {
      GroupSet.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ course: courseId }),
      });
      require('../../../models/course.model').findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(course),
      });

      const resolved = await resolveCourseFromAssignment({
        _id: assignmentId,
        isGroupAssignment: true,
        groupSet: groupSetId,
      });

      expect(resolved).toMatchObject({ _id: courseId, title: 'Biology' });
    });

    it('fans out assignment.published for group assignments', async () => {
      await notifyAssignmentPublished({
        assignment: {
          _id: assignmentId,
          title: 'Group Lab',
          isGroupAssignment: true,
          groupSet: { course: courseId },
        },
        course,
        actor: { _id: actorId },
      });

      expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          domainEvent: 'assignment.published',
          recipientIds: [String(studentA), String(studentB)],
        })
      );
    });

    it('fans out assignment.created for published group assignments', async () => {
      await notifyAssignmentCreated({
        assignment: {
          _id: assignmentId,
          title: 'Group Lab',
          published: true,
          groupSet: { course: courseId },
        },
        course,
        actor: { _id: actorId },
      });

      expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ domainEvent: 'assignment.created' })
      );
    });

    it('fans out assignment.updated for published group assignments', async () => {
      await notifyAssignmentUpdated({
        assignment: {
          _id: assignmentId,
          title: 'Group Lab',
          published: true,
          groupSet: { course: courseId },
        },
        course,
        actor: { _id: actorId },
      });

      expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ domainEvent: 'assignment.updated' })
      );
    });

    it('still resolves course via module path', async () => {
      const moduleId = new mongoose.Types.ObjectId();
      Module.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ course: courseId }),
      });
      require('../../../models/course.model').findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(course),
      });

      const resolved = await resolveCourseFromAssignment({
        _id: assignmentId,
        module: moduleId,
      });

      expect(resolved).toMatchObject({ _id: courseId });
    });
  });

  describe('group discussion recipient scoping', () => {
    it('uses group-scoped recipients for discussion.created', async () => {
      const thread = { _id: threadId, title: 'Group Topic', course: courseId, groupSet: groupSetId };

      await notifyDiscussionCreated({ thread, course, actor: { _id: actorId } });

      expect(discussionAccess.resolveDiscussionStudentRecipientIds).toHaveBeenCalledWith(
        thread,
        course
      );
      expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ recipientIds: [String(studentA)] })
      );
    });

    it('suppresses discussion.created when thread is unpublished', async () => {
      discussionWorkflow.isDiscussionPublished.mockReturnValue(false);

      await notifyDiscussionCreated({
        thread: { _id: threadId, title: 'Draft', course: courseId },
        course,
        actor: { _id: actorId },
      });

      expect(fanoutAcademicDomainNotifications).not.toHaveBeenCalled();
    });

    it('uses group-scoped recipients for staff discussion.reply', async () => {
      const thread = { _id: threadId, title: 'Group Topic', course: courseId, groupSet: groupSetId };

      await notifyDiscussionReplyPosted({
        thread,
        course,
        actor: { _id: actorId, firstName: 'Teach', lastName: 'Er', role: 'teacher' },
      });

      expect(discussionAccess.isCourseStaff).toHaveBeenCalled();
      expect(discussionAccess.resolveDiscussionStudentRecipientIds).toHaveBeenCalled();
      expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ domainEvent: 'discussion.reply' })
      );
    });

    it('notifies instructor, admins, and TAs for student discussion.reply', async () => {
      discussionAccess.isCourseStaff.mockReturnValue(false);

      await notifyDiscussionReplyPosted({
        thread: { _id: threadId, title: 'Topic', course: courseId, published: true },
        course,
        actor: { _id: studentA, firstName: 'Stu', lastName: 'Dent', role: 'student' },
      });

      expect(discussionAccess.resolveCourseStaffRecipientIds).toHaveBeenCalledWith(course);
      expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: expect.arrayContaining([
            String(actorId),
            String(adminId),
            String(taId),
          ]),
        })
      );
    });

    it('suppresses discussion.reply when thread is unpublished', async () => {
      discussionWorkflow.isDiscussionPublished.mockReturnValue(false);

      await notifyDiscussionReplyPosted({
        thread: { _id: threadId, title: 'Draft', course: courseId },
        course,
        actor: { _id: studentA, firstName: 'Stu', lastName: 'Dent', role: 'student' },
      });

      expect(fanoutAcademicDomainNotifications).not.toHaveBeenCalled();
    });
  });

  describe('discussion grade visibility', () => {
    const thread = {
      _id: threadId,
      title: 'Graded Topic',
      course: courseId,
      isGraded: true,
      studentGrades: [],
    };

    it('sends notification when grade is visible', async () => {
      discussionGradeVisibility.findStudentGrade.mockReturnValue({ grade: 8 });
      discussionGradeVisibility.resolveDiscussionGradeVisibility.mockReturnValue({
        scoreVisible: true,
      });
      createNotificationFromDomainEvent.mockResolvedValue({ _id: 'n1' });

      await notifyDiscussionGraded({
        thread,
        studentId: studentA,
        grade: 8,
        course,
        actor: { _id: actorId },
      });

      expect(createNotificationFromDomainEvent).toHaveBeenCalled();
    });

    it('suppresses notification when grade is hidden', async () => {
      discussionGradeVisibility.findStudentGrade.mockReturnValue({ grade: 8 });
      discussionGradeVisibility.resolveDiscussionGradeVisibility.mockReturnValue({
        scoreVisible: false,
        mode: 'hidden',
      });

      await notifyDiscussionGraded({
        thread,
        studentId: studentA,
        grade: 8,
        course,
        actor: { _id: actorId },
      });

      expect(createNotificationFromDomainEvent).not.toHaveBeenCalled();
    });

    it('suppresses notification when grade is unreleased', async () => {
      discussionGradeVisibility.findStudentGrade.mockReturnValue({ grade: 8 });
      discussionGradeVisibility.resolveDiscussionGradeVisibility.mockReturnValue({
        scoreVisible: false,
        mode: 'none',
      });

      await notifyDiscussionGraded({
        thread,
        studentId: studentA,
        grade: 8,
        course,
        actor: { _id: actorId },
      });

      expect(createNotificationFromDomainEvent).not.toHaveBeenCalled();
    });
  });

  describe('grades.amended event window sequencing', () => {
    it('includes amendment sequence in event window suffix', async () => {
      await notifyGradesAmended({
        course,
        studentIds: [studentA],
        actor: { _id: actorId },
        reason: 'Correction',
        amendmentSequence: 2,
      });

      expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          buildContextForRecipient: expect.any(Function),
        })
      );

      const call = fanoutAcademicDomainNotifications.mock.calls[0][0];
      const context = call.buildContextForRecipient(String(studentA));
      expect(context.eventWindowSuffix).toBe('amended:2');
    });

    it('produces distinct suffixes for amendment 1 and 2', async () => {
      const suffixes = [];
      for (const seq of [1, 2]) {
        fanoutAcademicDomainNotifications.mockClear();
        await notifyGradesAmended({
          course,
          studentIds: [studentA],
          actor: { _id: actorId },
          reason: 'Correction',
          amendmentSequence: seq,
        });
        const call = fanoutAcademicDomainNotifications.mock.calls[0][0];
        suffixes.push(call.buildContextForRecipient(String(studentA)).eventWindowSuffix);
      }
      expect(suffixes).toEqual(['amended:1', 'amended:2']);
    });
  });
});
