jest.mock('../../../models/course.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/user.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../services/discussionWorkflow.service', () => ({
  isDiscussionPublished: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../services/notification/academicNotificationExpansion.service', () => ({
  fanoutAcademicDomainNotifications: jest.fn().mockResolvedValue({ delivered: 1 }),
  normalizeObjectIdString: jest.requireActual(
    '../../../services/notification/academicNotificationExpansion.service'
  ).normalizeObjectIdString,
}));

const mongoose = require('mongoose');
const User = require('../../../models/user.model');
const discussionAccess = require('../../../services/discussionAccess.service');
const { fanoutAcademicDomainNotifications } = require('../../../services/notification/academicNotificationExpansion.service');
const {
  notifyDiscussionReplyPosted,
} = require('../../../services/notification/academicNotificationProducers.service');

describe('academicNotificationProducers.service phase11b sprint2', () => {
  const courseId = new mongoose.Types.ObjectId();
  const instructorId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const taOnCourseId = new mongoose.Types.ObjectId();
  const taOffCourseId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const threadId = new mongoose.Types.ObjectId();

  const course = {
    _id: courseId,
    title: 'Physics',
    students: [studentId],
    instructor: instructorId,
    admins: [adminId],
    teachingAssistants: [taOnCourseId],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats course-scoped TA as staff using isCourseStaff', async () => {
    const studentRecipientsSpy = jest
      .spyOn(discussionAccess, 'resolveDiscussionStudentRecipientIds')
      .mockResolvedValue([String(studentId)]);

    await notifyDiscussionReplyPosted({
      thread: { _id: threadId, title: 'Lab', course: courseId, published: true },
      course,
      actor: { _id: taOnCourseId, role: 'teaching_assistant' },
    });

    expect(studentRecipientsSpy).toHaveBeenCalled();
    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'discussion.reply',
        actorId: taOnCourseId,
      })
    );

    studentRecipientsSpy.mockRestore();
  });

  it('does not treat global TA absent from course.teachingAssistants as staff', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: taOffCourseId, role: 'teaching_assistant' }),
    });

    await notifyDiscussionReplyPosted({
      thread: { _id: threadId, title: 'Lab', course: courseId, published: true },
      course,
      actor: { _id: taOffCourseId },
    });

    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: expect.arrayContaining([
          String(instructorId),
          String(adminId),
          String(taOnCourseId),
        ]),
      })
    );
  });

  it('deduplicates staff recipients when instructor is also listed as admin', () => {
    const duplicateCourse = {
      instructor: instructorId,
      admins: [instructorId, adminId],
      teachingAssistants: [adminId],
    };

    const recipients = discussionAccess.resolveCourseStaffRecipientIds(duplicateCourse);

    expect(recipients).toHaveLength(2);
    expect(recipients).toEqual(
      expect.arrayContaining([String(instructorId), String(adminId)])
    );
  });
});
