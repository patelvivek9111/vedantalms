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

describe('§9.5 discussion reply policy — HTTP API', () => {
  let mongoServer;
  let app;
  let studentToken;
  let studentId;
  let classmateToken;
  let courseId;
  let threadId;
  let rootReplyId;
  let nestedReplyId;

  beforeAll(async () => {
    ({ mongoServer } = await startDiscussionApiMongo());
    app = createDiscussionApp({ includeReplyRoutes: true });

    const teacher = await User.create({
      firstName: 'Policy',
      lastName: 'Teacher',
      email: `policy-teacher-${RUN_ID}@example.com`,
      password: 'password123',
      role: 'teacher',
    });

    const student = await User.create({
      firstName: 'Policy',
      lastName: 'Student',
      email: `policy-student-${RUN_ID}@example.com`,
      password: 'password123',
      role: 'student',
    });
    studentId = student._id;
    studentToken = student.getSignedJwtToken();

    const classmate = await User.create({
      firstName: 'Policy',
      lastName: 'Classmate',
      email: `policy-classmate-${RUN_ID}@example.com`,
      password: 'password123',
      role: 'student',
    });
    classmateToken = classmate.getSignedJwtToken();

    const course = await Course.create({
      title: `Policy course ${RUN_ID}`,
      description: 'Discussion reply policy regression tests',
      instructor: teacher._id,
      students: [studentId, classmate._id],
      operationalStatus: 'active',
    });
    courseId = course._id;

    const thread = await Thread.create({
      title: `Policy thread ${RUN_ID}`,
      content: '<p>Thread for reply policy tests.</p>',
      course: courseId,
      author: teacher._id,
      published: true,
      availableFrom: new Date(Date.now() - 86_400_000),
      settings: { allowComments: true, allowLikes: true, requirePostBeforeSee: false },
    });
    threadId = thread._id;

    const rootRes = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${classmateToken}`)
      .send({
        content: '<p>Root main post for depth policy.</p>',
        idempotencyKey: `policy-root-${RUN_ID}`,
      });
    expect(rootRes.status).toBe(200);
    rootReplyId = rootRes.body.createdReply?._id || rootRes.body.createdReply?.id;
    expect(rootReplyId).toBeTruthy();

    const nestedRes = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        content: '<p>Nested reply at max depth.</p>',
        parentReply: rootReplyId,
        idempotencyKey: `policy-nested-${RUN_ID}`,
      });
    expect(nestedRes.status).toBe(200);
    nestedReplyId = nestedRes.body.createdReply?._id || nestedRes.body.createdReply?.id;
    expect(nestedReplyId).toBeTruthy();
  }, 180_000);

  afterAll(async () => {
    await stopDiscussionApiMongo(mongoServer, { threadId });
  });

  it('rejects reply-to-nested with REPLY_DEPTH_EXCEEDED', async () => {
    const res = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        content: '<p>Third level should be forbidden.</p>',
        parentReply: nestedReplyId,
        idempotencyKey: `policy-too-deep-${RUN_ID}`,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REPLY_DEPTH_EXCEEDED');
  });

  it('forbids author delete on root main post', async () => {
    const res = await request(app)
      .delete(`/api/threads/${threadId}/replies/${rootReplyId}`)
      .set('Authorization', `Bearer ${classmateToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ROOT_REPLY_DELETE_FORBIDDEN');
  });

  it('sets no-store cache headers on children replies endpoint', async () => {
    const res = await request(app)
      .get(`/api/replies/${rootReplyId}/children`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/i);
    expect(res.headers.pragma).toBe('no-cache');
    expect(res.headers.vary).toMatch(/authorization/i);
  });
});
