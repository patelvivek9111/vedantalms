/**
 * Inbox policy integration tests — run with MESSAGING_POLICY_ENFORCED=true.
 * Default inbox.test.js keeps policy off for backwards-compatible behavior.
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

describe('Inbox API — messaging policy enforced', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let outsiderToken;
  let courseId;
  let enforcedPrev;

  beforeAll(async () => {
    enforcedPrev = process.env.MESSAGING_POLICY_ENFORCED;
    process.env.MESSAGING_POLICY_ENFORCED = 'true';
    process.env.MESSAGING_POLICY = 'course_scoped';

    await waitForMongoConnection(MONGODB_URI);

    await User.deleteMany({
      email: {
        $in: [
          'teacher-policy-inbox@test.com',
          'student-policy-inbox@test.com',
          'outsider-policy-inbox@test.com',
        ],
      },
    });
    await Course.deleteMany({ title: 'Inbox Policy Test Course' });
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await ConversationParticipant.deleteMany({});

    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Policy',
        email: 'teacher-policy-inbox@test.com',
        password: 'password123',
        role: 'teacher',
      });
    teacherToken = teacherResponse.body.token;
    teacherId = teacherResponse.body.user.id;

    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Policy',
        email: 'student-policy-inbox@test.com',
        password: 'password123',
        role: 'student',
      });
    studentToken = studentResponse.body.token;
    studentId = studentResponse.body.user.id;

    const outsider = await User.create({
      firstName: 'Out',
      lastName: 'Side',
      email: 'outsider-policy-inbox@test.com',
      password: 'password123',
      role: 'student',
    });
    outsiderToken = outsider.getSignedJwtToken();

    const courseResponse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Inbox Policy Test Course',
        description: 'Policy tests',
        code: 'INBPOL101',
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    await request(app)
      .post(`/api/courses/${courseId}/enroll-teacher`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ studentId });
  });

  afterAll(async () => {
    process.env.MESSAGING_POLICY_ENFORCED = enforcedPrev;

    await User.deleteMany({
      email: {
        $in: [
          'teacher-policy-inbox@test.com',
          'student-policy-inbox@test.com',
          'outsider-policy-inbox@test.com',
        ],
      },
    });
    await Course.deleteMany({ title: 'Inbox Policy Test Course' });
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await ConversationParticipant.deleteMany({});

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('allows instructor to message enrolled student with course context', async () => {
    const response = await request(app)
      .post('/api/inbox/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        subject: 'Course thread',
        participantIds: [studentId],
        body: 'Hello enrolled student',
        course: courseId,
      });

    expect(response.status).toBe(201);
    expect(response.body.conversation).toBeDefined();
  });

  it('blocks messaging student not on course roster', async () => {
    const outsiderRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Other',
        lastName: 'Student',
        email: 'other-policy-inbox@test.com',
        password: 'password123',
        role: 'student',
      });
    const otherId = outsiderRes.body.user.id;

    const response = await request(app)
      .post('/api/inbox/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        subject: 'Not on roster',
        participantIds: [otherId],
        body: 'Should fail',
        course: courseId,
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('NOT_COURSE_PEER');

    await User.deleteMany({ email: 'other-policy-inbox@test.com' });
  });

  it('blocks student compose without course context', async () => {
    const response = await request(app)
      .post('/api/inbox/conversations')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        subject: 'No course',
        participantIds: [teacherId],
        body: 'Need course',
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('COURSE_REQUIRED');
  });

  it('allows enrolled student to message instructor with course context', async () => {
    const response = await request(app)
      .post('/api/inbox/conversations')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        subject: 'Question',
        participantIds: [teacherId],
        body: 'Hi instructor',
        course: courseId,
      });

    expect(response.status).toBe(201);
  });

  it('blocks outsider student from viewing enrolled thread', async () => {
    const createResponse = await request(app)
      .post('/api/inbox/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        subject: 'Private course thread',
        participantIds: [studentId],
        body: 'Private',
        course: courseId,
      });

    const conversationId =
      createResponse.body.conversation._id || createResponse.body.conversation.id;

    const response = await request(app)
      .get(`/api/inbox/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
  });
});
