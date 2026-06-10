jest.mock('../../../models/course.model');
jest.mock('../../../models/user.model');
jest.mock('../../../models/systemSettings.model');
jest.mock('../../../services/ferpaAudit.service', () => ({
  recordFerpaEvent: jest.fn().mockResolvedValue(undefined),
}));

const Course = require('../../../models/course.model');
const User = require('../../../models/user.model');
const SystemSettings = require('../../../models/systemSettings.model');
const participantPolicy = require('../../../services/participantPolicy.service');

describe('participantPolicy.service', () => {
  const originalEnforced = process.env.MESSAGING_POLICY_ENFORCED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MESSAGING_POLICY_ENFORCED = 'true';
    process.env.MESSAGING_POLICY = 'course_scoped';
    delete process.env.MESSAGING_ALLOW_STUDENT_TO_STUDENT;

    SystemSettings.getSettings = jest.fn().mockResolvedValue({
      messaging: {
        mode: 'course_scoped',
        allowStudentToStudent: false,
        maxRecipientsPerMessage: 50,
        maxSendIndividuallyBatch: 25,
      },
    });
  });

  afterAll(() => {
    process.env.MESSAGING_POLICY_ENFORCED = originalEnforced;
  });

  const courseDoc = {
    _id: '507f1f77bcf86cd799439011',
    instructor: 't1',
    teachingAssistants: [],
    students: ['s1'],
    operationalStatus: 'active',
  };

  it('skips checks when policy is not enforced', async () => {
    process.env.MESSAGING_POLICY_ENFORCED = 'false';
    const result = await participantPolicy.assertCanAddParticipants({
      sender: { _id: 'x', role: 'student' },
      participantIds: ['y'],
      courseId: null,
      req: {},
    });
    expect(result.policy.enforced).toBe(false);
    expect(Course.findById).not.toHaveBeenCalled();
  });

  it('allows instructor to message enrolled student in course', async () => {
    Course.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(courseDoc),
    });
    User.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: 's1', role: 'student' }]),
    });

    const teacher = { _id: 't1', role: 'teacher' };
    await expect(
      participantPolicy.assertCanAddParticipants({
        sender: teacher,
        participantIds: ['s1'],
        courseId: courseDoc._id,
        req: {},
      })
    ).resolves.toMatchObject({ policy: expect.objectContaining({ mode: 'course_scoped' }) });
  });

  it('blocks student DM without course context', async () => {
    User.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: 's2', role: 'student' }]),
    });

    await expect(
      participantPolicy.assertCanAddParticipants({
        sender: { _id: 's1', role: 'student' },
        participantIds: ['s2'],
        courseId: null,
        req: {},
      })
    ).rejects.toMatchObject({ code: 'COURSE_REQUIRED', statusCode: 403 });
  });

  it('blocks student-to-student messaging in course when disabled', async () => {
    const courseBothStudents = {
      ...courseDoc,
      students: ['s1', 's2'],
      instructor: 't9',
    };
    Course.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(courseBothStudents),
    });
    User.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: 's2', role: 'student' }]),
    });

    await expect(
      participantPolicy.assertCanAddParticipants({
        sender: { _id: 's1', role: 'student' },
        participantIds: ['s2'],
        courseId: courseDoc._id,
        req: {},
      })
    ).rejects.toMatchObject({ code: 'STUDENT_DM_DISABLED', statusCode: 403 });
  });

  it('blocks messaging peer not in course roster', async () => {
    Course.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(courseDoc),
    });
    User.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: 's9', role: 'student' }]),
    });

    await expect(
      participantPolicy.assertCanAddParticipants({
        sender: { _id: 't1', role: 'teacher' },
        participantIds: ['s9'],
        courseId: courseDoc._id,
        req: {},
      })
    ).rejects.toMatchObject({ code: 'NOT_COURSE_PEER', statusCode: 403 });
  });
});
