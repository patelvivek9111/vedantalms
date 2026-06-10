jest.mock('../../../models/course.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/module.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../models/user.model', () => ({
  findById: jest.fn(),
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
  isAcademicNotificationExpansionEnabled: jest.fn(),
  buildAcademicEventWindow: jest.fn(),
}));

const mongoose = require('mongoose');
const Course = require('../../../models/course.model');
const {
  fanoutAcademicDomainNotifications,
  resolveCourseStudentIds,
  isAcademicNotificationExpansionEnabled,
} = require('../../../services/notification/academicNotificationExpansion.service');
const {
  notifyAssignmentPublished,
  notifyCoursePublished,
} = require('../../../services/notification/academicNotificationProducers.service');

describe('academicNotificationProducers.service', () => {
  const courseId = new mongoose.Types.ObjectId();
  const assignmentId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    resolveCourseStudentIds.mockResolvedValue([String(studentId)]);
  });

  it('fans out assignment.published to enrolled students', async () => {
    Course.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: courseId,
        title: 'Biology',
        students: [studentId],
      }),
    });
    fanoutAcademicDomainNotifications.mockResolvedValue({ delivered: 1 });

    await notifyAssignmentPublished({
      assignment: { _id: assignmentId, title: 'Lab 1', module: { course: courseId } },
      course: { _id: courseId, title: 'Biology', students: [studentId] },
      actor: { _id: actorId },
    });

    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'assignment.published',
        relatedId: String(assignmentId),
        relatedType: 'assignment',
      })
    );
  });

  it('fans out course.published to enrolled students', async () => {
    fanoutAcademicDomainNotifications.mockResolvedValue({ delivered: 1 });

    await notifyCoursePublished({
      course: { _id: courseId, title: 'History', students: [studentId] },
      actor: { _id: actorId },
    });

    expect(resolveCourseStudentIds).toHaveBeenCalled();
    expect(fanoutAcademicDomainNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        domainEvent: 'course.published',
        relatedType: 'course',
      })
    );
  });
});
