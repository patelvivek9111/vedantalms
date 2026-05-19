const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const gradeLifecycleService = require('../../services/gradeLifecycle.service');
const Course = require('../../models/course.model');
const User = require('../../models/user.model');
const CourseGradeLifecycle = require('../../models/courseGradeLifecycle.model');

describe('gradeLifecycle.service', () => {
  let mongoServer;
  let course;
  let teacher;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    teacher = await User.create({
      firstName: 'T',
      lastName: 'L',
      email: `tl.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    course = await Course.create({
      title: 'Lifecycle Test',
      description: 'Test',
      instructor: teacher._id,
      students: [],
      published: true,
      semester: { term: 'Fall', year: 2024 },
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('creates DRAFT lifecycle by default', async () => {
    const doc = await gradeLifecycleService.getOrCreateLifecycle(course);
    expect(doc.status).toBe('DRAFT');
    expect(doc.term).toBe('Fall');
    expect(doc.year).toBe(2024);
  });

  it('transitions DRAFT to POSTED', async () => {
    const posted = await gradeLifecycleService.transitionToPosted(course._id, teacher, course);
    expect(posted.status).toBe('POSTED');
    expect(posted.postedAt).toBeTruthy();
  });

  it('assertCanEditGrades throws when FINALIZED', async () => {
    await CourseGradeLifecycle.updateOne(
      { course: course._id, term: 'Fall', year: 2024 },
      { status: 'FINALIZED' }
    );
    await expect(
      gradeLifecycleService.assertCanEditGrades(course._id, 'Fall', 2024)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
