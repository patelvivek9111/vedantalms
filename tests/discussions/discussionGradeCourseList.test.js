/**
 * Course thread list must include studentGrades + release fields so student views can resolve scores.
 */
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const Course = require('../../models/course.model');
const User = require('../../models/user.model');
const Thread = require('../../models/thread.model');
const discussionAccess = require('../../services/discussionAccess.service');
const { LIST_SELECT } = require('../../services/discussionList.service');

describe('discussion grade on course thread list', () => {
  let mongoServer;
  let student;
  let thread;

  beforeAll(async () => {
    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();

    const teacher = await User.create({
      firstName: 'List',
      lastName: 'Teacher',
      email: `list.teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });

    student = await User.create({
      firstName: 'List',
      lastName: 'Student',
      email: `list.student.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });

    const course = await Course.create({
      title: 'List Grade Course',
      description: 'Test',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      groups: [{ name: 'Discussions', weight: 100 }],
    });

    thread = await Thread.create({
      title: 'Introduce yourself',
      content: 'Say hi',
      course: course._id,
      author: teacher._id,
      isGraded: true,
      totalPoints: 100,
      discussionReleaseMode: 'immediate',
      dueDate: new Date('2025-10-22T16:30:00.000Z'),
      studentGrades: [
        {
          student: student._id,
          grade: 80,
          feedback: 'Nice intro',
          gradedAt: new Date(),
          gradedBy: teacher._id,
        },
      ],
    });
  }, 120000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) await mongoServer.stop();
  });

  it('LIST_SELECT includes grade fields required for student visibility', () => {
    expect(LIST_SELECT).toContain('studentGrades');
    expect(LIST_SELECT).toContain('discussionReleaseMode');
    expect(LIST_SELECT).toContain('gradesReleasedAt');
    expect(LIST_SELECT).toContain('gradeHidden');
  });

  it('course list query returns student grade after filterDiscussionForStudent', async () => {
    const lean = await Thread.findById(thread._id).select(LIST_SELECT).lean();
    expect(lean.studentGrades).toHaveLength(1);

    const filtered = discussionAccess.filterDiscussionForStudent(student, lean);
    expect(filtered.grade).toBe(80);
    expect(filtered.gradeVisibility?.scoreVisible).toBe(true);
    expect(filtered.studentGrades).toHaveLength(1);
    expect(filtered.studentGrades[0].grade).toBe(80);
  });
});
