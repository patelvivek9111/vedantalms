const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../../models/user.model');
const Course = require('../../models/course.model');
const Thread = require('../../models/thread.model');
const DiscussionReply = require('../../models/discussionReply.model');
const {
  startDiscussionApiMongo,
  stopDiscussionApiMongo,
  createDiscussionApp,
} = require('./discussionApiTestHarness');

const RUN_ID = Date.now();

describe('§9.5 legacy + collection reply merge — HTTP API', () => {
  let mongoServer;
  let app;
  let teacherToken;
  let studentToken;
  let classmateToken;
  let courseId;
  let threadId;
  let legacyReplyId;

  beforeAll(async () => {
    ({ mongoServer } = await startDiscussionApiMongo());
    app = createDiscussionApp();

    const teacher = await User.create({
      firstName: 'Legacy',
      lastName: 'Teacher',
      email: `legacy-teacher-${RUN_ID}@example.com`,
      password: 'password123',
      role: 'teacher',
    });
    teacherToken = teacher.getSignedJwtToken();

    const student = await User.create({
      firstName: 'Legacy',
      lastName: 'Student',
      email: `legacy-student-${RUN_ID}@example.com`,
      password: 'password123',
      role: 'student',
    });
    studentToken = student.getSignedJwtToken();

    const classmate = await User.create({
      firstName: 'Legacy',
      lastName: 'Classmate',
      email: `legacy-classmate-${RUN_ID}@example.com`,
      password: 'password123',
      role: 'student',
    });
    classmateToken = classmate.getSignedJwtToken();

    const course = await Course.create({
      title: `Legacy merge course ${RUN_ID}`,
      description: 'Mixed embedded + collection reply regression',
      instructor: teacher._id,
      students: [student._id, classmate._id],
      operationalStatus: 'active',
    });
    courseId = course._id;

    legacyReplyId = new mongoose.Types.ObjectId();
    const thread = await Thread.create({
      title: `Legacy merge thread ${RUN_ID}`,
      content: '<p>Mixed reply sources.</p>',
      course: courseId,
      author: teacher._id,
      published: true,
      availableFrom: new Date(Date.now() - 86_400_000),
      settings: { allowComments: true, allowLikes: true, requirePostBeforeSee: false },
      replies: [
        {
          _id: legacyReplyId,
          author: classmate._id,
          content: '<p>Legacy embedded root reply.</p>',
          createdAt: new Date('2025-12-01T00:00:00.000Z'),
        },
      ],
    });
    threadId = thread._id;

    const collectionRes = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        content: '<p>Collection root reply.</p>',
        idempotencyKey: `legacy-collection-${RUN_ID}`,
      });
    expect(collectionRes.status).toBe(200);
  }, 180_000);

  afterAll(async () => {
    await stopDiscussionApiMongo(mongoServer, { threadId });
  });

  it('returns mixed source with legacy embedded + collection replies after refresh', async () => {
    const res = await request(app)
      .get(`/api/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('mixed');
    const ids = res.body.data.map((row) => String(row._id));
    expect(ids).toContain(String(legacyReplyId));
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('excludes migrated legacy rows when legacyReplyId is set on collection doc', async () => {
    const collectionRow = await DiscussionReply.findOne({ threadId }).lean();
    expect(collectionRow).toBeTruthy();

    await DiscussionReply.updateOne(
      { _id: collectionRow._id },
      { $set: { legacyReplyId: String(legacyReplyId) } }
    );

    const res = await request(app)
      .get(`/api/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('collection');
    const ids = res.body.data.map((row) => String(row._id));
    expect(ids).not.toContain(String(legacyReplyId));
    expect(ids).toContain(String(collectionRow._id));
  });
});
