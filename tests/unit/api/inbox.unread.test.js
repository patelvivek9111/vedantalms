/**
 * Inbox denormalized unread — requires INBOX_DENORM_UNREAD=true and backfilled counts.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../../models/user.model');
const Course = require('../../../models/course.model');
const Conversation = require('../../../models/Conversation');
const Message = require('../../../models/Message');
const ConversationParticipant = require('../../../models/ConversationParticipant');
const { waitForMongoConnection } = require('../../helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Inbox API — denormalized unread', () => {
  let teacherToken;
  let studentToken;
  let studentId;
  let courseId;
  let conversationId;
  let denormPrev;

  beforeAll(async () => {
    denormPrev = process.env.INBOX_DENORM_UNREAD;
    process.env.INBOX_DENORM_UNREAD = 'true';

    await waitForMongoConnection(MONGODB_URI);

    await User.deleteMany({
      email: { $in: ['teacher-unread@test.com', 'student-unread@test.com'] },
    });
    await Course.deleteMany({ title: 'Inbox Unread Test Course' });

    const teacherRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Unread',
        email: 'teacher-unread@test.com',
        password: 'password123',
        role: 'teacher',
      });
    teacherToken = teacherRes.body.token;

    const studentRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Unread',
        email: 'student-unread@test.com',
        password: 'password123',
        role: 'student',
      });
    studentToken = studentRes.body.token;
    studentId = studentRes.body.user.id;

    const testUserIds = [teacherRes.body.user.id, studentId];
    const existingConvIds = await ConversationParticipant.distinct('conversationId', {
      userId: { $in: testUserIds },
    });
    if (existingConvIds.length) {
      await Message.deleteMany({ conversationId: { $in: existingConvIds } });
      await ConversationParticipant.deleteMany({ conversationId: { $in: existingConvIds } });
      await Conversation.deleteMany({ _id: { $in: existingConvIds } });
    }

    const courseRes = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Inbox Unread Test Course',
        description: 'Unread tests',
        code: 'INBUR101',
      });
    courseId = courseRes.body.data._id || courseRes.body.data.id;

    await request(app)
      .post(`/api/courses/${courseId}/enroll-teacher`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ studentId });

    const createRes = await request(app)
      .post('/api/inbox/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        subject: 'Unread thread',
        participantIds: [studentId],
        body: 'Initial',
        course: courseId,
      });
    conversationId = createRes.body.conversation._id || createRes.body.conversation.id;
  });

  afterAll(async () => {
    process.env.INBOX_DENORM_UNREAD = denormPrev;
    const testUsers = await User.find({
      email: { $in: ['teacher-unread@test.com', 'student-unread@test.com'] },
    }).select('_id');
    const ids = testUsers.map((u) => u._id);
    if (ids.length) {
      const convIds = await ConversationParticipant.distinct('conversationId', { userId: { $in: ids } });
      if (convIds.length) {
        await Message.deleteMany({ conversationId: { $in: convIds } });
        await ConversationParticipant.deleteMany({ conversationId: { $in: convIds } });
        await Conversation.deleteMany({ _id: { $in: convIds } });
      }
    }
    await User.deleteMany({
      email: { $in: ['teacher-unread@test.com', 'student-unread@test.com'] },
    });
    await Course.deleteMany({ title: 'Inbox Unread Test Course' });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('GET /unread-count returns student unread after teacher message', async () => {
    const res = await request(app)
      .get('/api/inbox/unread-count')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it('markAsRead clears student unread count', async () => {
    await request(app)
      .post(`/api/inbox/conversations/${conversationId}/read`)
      .set('Authorization', `Bearer ${studentToken}`);

    const listRes = await request(app)
      .get('/api/inbox/conversations')
      .set('Authorization', `Bearer ${studentToken}`);

    const thread = listRes.body.find((c) => String(c._id) === String(conversationId));
    expect(thread?.unreadCount).toBe(0);

    const countRes = await request(app)
      .get('/api/inbox/unread-count')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(countRes.body.count).toBe(0);
  });

  it('sendMessage increments recipient unread when denorm enabled', async () => {
    await request(app)
      .post(`/api/inbox/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ body: 'Another message' });

    const countRes = await request(app)
      .get('/api/inbox/unread-count')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(countRes.body.count).toBeGreaterThanOrEqual(1);
  });
});
