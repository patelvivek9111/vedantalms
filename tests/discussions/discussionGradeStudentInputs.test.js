/**
 * Student-visible discussion grades require isGraded + release metadata on catalog rows.
 */
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');
const Course = require('../../models/course.model');
const User = require('../../models/user.model');
const Thread = require('../../models/thread.model');
const DiscussionReply = require('../../models/discussionReply.model');
const { loadCourseGradeAssignments, buildStudentGradeInputs } = require('../../services/gradeCalculationInputs.service');
const { resolveSubmissionGradeStatus, GRADE_STATUS } = require('../../shared/grading/gradeStatus.cjs');

describe('discussion grade student visibility in grade inputs', () => {
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
      firstName: 'Discuss',
      lastName: 'Teacher',
      email: `discuss.teacher.${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
    });

    const student = await User.create({
      firstName: 'Discuss',
      lastName: 'Student',
      email: `discuss.student.${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    studentId = student._id;

    const course = await Course.create({
      title: 'Discussion Grade Course',
      description: 'Test',
      instructor: teacher._id,
      students: [student._id],
      published: true,
      groups: [{ name: 'Discussions', weight: 100 }],
    });
    courseId = course._id;

    const thread = await Thread.create({
      title: 'Introduce yourself',
      content: 'Say hi',
      course: courseId,
      author: teacher._id,
      isGraded: true,
      totalPoints: 100,
      discussionReleaseMode: 'immediate',
      studentGrades: [
        {
          student: student._id,
          grade: 95,
          feedback: 'Great intro',
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

  it('loadCourseGradeAssignments includes discussion release metadata', async () => {
    const catalog = await loadCourseGradeAssignments(courseId);
    const discussion = catalog.find((row) => String(row._id) === threadId);
    expect(discussion).toBeTruthy();
    expect(discussion.isGraded).toBe(true);
    expect(discussion.discussionReleaseMode).toBe('immediate');
    expect(discussion.studentGrades).toHaveLength(1);
  });

  it('buildStudentGradeInputs exposes released discussion grade to students', async () => {
    const course = await Course.findById(courseId).lean();
    const catalog = await loadCourseGradeAssignments(courseId);
    const { allAssignments } = await buildStudentGradeInputs(
      course,
      studentId,
      catalog,
      'student'
    );
    const discussion = allAssignments.find((row) => String(row._id) === threadId);
    expect(discussion?.grade).toBe(95);
    expect(discussion?.gradeVisibility?.scoreVisible).toBe(true);
  });

  it('buildStudentGradeInputs includes studentReplyCreatedAt for late detection', async () => {
    const lateThread = await Thread.create({
      title: 'Late discussion',
      content: 'Post late',
      course: courseId,
      author: (await User.findOne({ role: 'teacher' }))._id,
      isGraded: true,
      totalPoints: 50,
      published: true,
      dueDate: new Date('2025-11-01T00:00:00.000Z'),
      discussionReleaseMode: 'immediate',
    });

    const lateAt = new Date('2025-11-10T12:00:00.000Z');
    await DiscussionReply.create({
      threadId: lateThread._id,
      authorId: studentId,
      content: 'Late post',
      sanitizedContent: 'Late post',
      createdAt: lateAt,
    });

    const course = await Course.findById(courseId).lean();
    const catalog = await loadCourseGradeAssignments(courseId);
    const { allAssignments } = await buildStudentGradeInputs(course, studentId, catalog, 'student');
    const discussion = allAssignments.find((row) => String(row._id) === String(lateThread._id));

    expect(discussion?.hasSubmitted).toBe(true);
    expect(new Date(discussion.studentReplyCreatedAt).toISOString()).toBe(lateAt.toISOString());

    const status = resolveSubmissionGradeStatus({
      assignment: discussion,
      perspective: 'student',
      studentId: String(studentId),
      hasSubmission: true,
      now: new Date('2025-12-01T00:00:00.000Z'),
    });
    expect(status.status).toBe(GRADE_STATUS.LATE);
  });
});
