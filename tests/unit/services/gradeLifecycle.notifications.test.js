jest.mock('../../../services/notification/academicNotificationProducers.service', () => ({
  notifyGradesPosted: jest.fn().mockResolvedValue({ delivered: 1 }),
  notifyGradesFinalized: jest.fn(),
  notifyGradesAmended: jest.fn(),
}));

const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../../mongoMemoryServer');
const gradeLifecycleService = require('../../../services/gradeLifecycle.service');
const Course = require('../../../models/course.model');
const User = require('../../../models/user.model');
const CourseGradeLifecycle = require('../../../models/courseGradeLifecycle.model');
const { notifyGradesPosted } = require('../../../services/notification/academicNotificationProducers.service');

describe('gradeLifecycle notification idempotency', () => {
  let mongoServer;
  let course;
  let teacher;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    await mongoose.connect(mongoServer.getUri());
    teacher = await User.create({
      firstName: 'T',
      lastName: 'L',
      email: `tl-notify.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    course = await Course.create({
      title: 'Notify Lifecycle Test',
      description: 'Test',
      instructor: teacher._id,
      students: [],
      published: true,
      semester: { term: 'Fall', year: 2025 },
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await CourseGradeLifecycle.deleteMany({ course: course._id });
  });

  it('sends grades.posted notification on first POSTED transition', async () => {
    await CourseGradeLifecycle.deleteMany({ course: course._id });

    await gradeLifecycleService.transitionToPosted(course._id, teacher, course);

    expect(notifyGradesPosted).toHaveBeenCalledTimes(1);
    expect(notifyGradesPosted).toHaveBeenCalledWith(
      expect.objectContaining({ course: expect.objectContaining({ _id: course._id }) })
    );
  });

  it('does not re-send grades.posted when already POSTED', async () => {
    await gradeLifecycleService.transitionToPosted(course._id, teacher, course);

    expect(notifyGradesPosted).toHaveBeenCalledTimes(1);

    await gradeLifecycleService.transitionToPosted(course._id, teacher, course);

    expect(notifyGradesPosted).toHaveBeenCalledTimes(1);
  });
});
