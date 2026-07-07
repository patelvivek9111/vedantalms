const request = require('supertest');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Thread = require('../../models/thread.model');
const {
  startDiscussionApiMongo,
  stopDiscussionApiMongo,
  createDiscussionApp,
} = require('./discussionApiTestHarness');

const RUN_ID = Date.now();

describe('POST /api/threads/:threadId/grade', () => {
  let mongoServer;
  let app;
  let teacherToken;
  let studentId;
  let threadId;

  beforeAll(async () => {
    ({ mongoServer } = await startDiscussionApiMongo());
    app = createDiscussionApp();

    const teacher = await User.create({
      firstName: 'Grade',
      lastName: 'Teacher',
      email: `grade-submit-teacher-${RUN_ID}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    teacherToken = teacher.getSignedJwtToken();

    const student = await User.create({
      firstName: 'Grade',
      lastName: 'Student',
      email: `grade-submit-student-${RUN_ID}@example.com`,
      password: 'password123',
      role: 'student',
    });
    studentId = String(student._id);

    const course = await Course.create({
      title: `Grade submit course ${RUN_ID}`,
      description: 'Discussion grade submit regression',
      instructor: teacher._id,
      students: [student._id],
      operationalStatus: 'active',
    });

    const thread = await Thread.create({
      title: 'Introduce yourself',
      content: '<p>Say hi</p>',
      course: course._id,
      author: teacher._id,
      isGraded: true,
      totalPoints: 100,
      discussionReleaseMode: 'immediate',
    });
    threadId = String(thread._id);
  }, 120_000);

  afterAll(async () => {
    await stopDiscussionApiMongo(mongoServer);
  });

  it('returns studentGrades in the response payload for instructors', async () => {
    const res = await request(app)
      .post(`/api/threads/${threadId}/grade`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        studentId,
        grade: 81,
        feedback: 'Good intro',
        releaseGrade: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.studentGrades)).toBe(true);
    expect(res.body.data.studentGrades.length).toBeGreaterThan(0);

    const row = res.body.data.studentGrades.find(
      (g) => String(g.student?._id || g.student) === studentId
    );
    expect(row?.grade).toBe(81);
    expect(row?.feedback).toContain('Good intro');
  });
});
