/**
 * Instructor gradebook API must include discussion grades in the grades map.
 */
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const Course = require('../../models/course.model');
const User = require('../../models/user.model');
const Thread = require('../../models/thread.model');
const { getCourseGradebookPage } = require('../../services/gradebookData.service');

describe('discussion grades in instructor gradebook', () => {
  let mongoServer;
  let courseId;
  let studentId;
  let threadId;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();

    const teacher = await User.create({
      firstName: 'Gb',
      lastName: 'Teacher',
      email: `gb.teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });

    const student = await User.create({
      firstName: 'Gb',
      lastName: 'Student',
      email: `gb.student.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    studentId = String(student._id);

    const course = await Course.create({
      title: 'Gradebook Discussion Course',
      description: 'Test',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      groups: [
        { name: 'Assignments', weight: 50 },
        { name: 'Discussions', weight: 50 },
      ],
    });
    courseId = course._id;

    const thread = await Thread.create({
      title: 'Introduce yourself',
      content: 'Say hi',
      course: courseId,
      author: teacher._id,
      isGraded: true,
      totalPoints: 100,
      group: 'Discussions',
      discussionReleaseMode: 'immediate',
      dueDate: new Date('2025-10-22T16:30:00.000Z'),
      studentGrades: [
        {
          student: student._id,
          grade: 80,
          gradedAt: new Date(),
          gradedBy: teacher._id,
        },
      ],
    });
    threadId = String(thread._id);
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  it('getCourseGradebookPage includes discussion score in grades map', async () => {
    const page = await getCourseGradebookPage(courseId, { page: 1, pageSize: 50 });
    const discussion = page.assignments.find((a) => String(a._id) === threadId);
    expect(discussion?.isDiscussion).toBe(true);
    expect(page.grades[studentId]?.[threadId]).toBe(80);
  });
});
