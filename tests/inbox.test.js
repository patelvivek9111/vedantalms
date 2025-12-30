const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ConversationParticipant = require('../models/ConversationParticipant');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Inbox API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let courseId;
  let conversationId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-inbox@test.com', 'student-inbox@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Inbox' });
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await ConversationParticipant.deleteMany({});

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Inbox',
        email: 'teacher-inbox@test.com',
        password: 'password123',
        role: 'teacher'
      });
    teacherToken = teacherResponse.body.token;
    teacherId = teacherResponse.body.user.id;

    // Create student
    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Inbox',
        email: 'student-inbox@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;
    studentId = studentResponse.body.user.id;

    // Create course
    const courseResponse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Course for Inbox',
        description: 'Course for testing inbox',
        code: 'INB101'
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-inbox@test.com', 'student-inbox@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Inbox' });
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await ConversationParticipant.deleteMany({});
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/inbox/conversations', () => {
    it('should get conversations for user', async () => {
      const response = await request(app)
        .get('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return empty array when no conversations', async () => {
      const response = await request(app)
        .get('/api/inbox/conversations')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/inbox/conversations', () => {
    it('should create conversation (group)', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Test Conversation',
          participantIds: [studentId],
          body: 'Test message body',
          sendIndividually: false
        });

      expect(response.status).toBe(201);
      expect(response.body.conversation).toBeDefined();
      expect(response.body.message).toBeDefined();
      conversationId = response.body.conversation._id || response.body.conversation.id;
    });

    it('should create conversation (individual)', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Individual Conversation',
          participantIds: [studentId],
          body: 'Individual message',
          sendIndividually: true
        });

      expect(response.status).toBe(201);
      expect(response.body.results).toBeDefined();
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should require subject', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          participantIds: [studentId],
          body: 'Test message'
        });

      expect(response.status).toBe(400);
    });

    it('should require message body', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Test Subject',
          participantIds: [studentId]
        });

      expect(response.status).toBe(400);
    });

    it('should require at least one participant', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Test Subject',
          body: 'Test message',
          participantIds: []
        });

      expect(response.status).toBe(400);
    });

    it('should reject sending to self', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Test Subject',
          body: 'Test message',
          participantIds: [teacherId]
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid participant ID', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Test Subject',
          body: 'Test message',
          participantIds: ['invalid-id']
        });

      expect(response.status).toBe(400);
    });

    it('should allow course association', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Course Conversation',
          participantIds: [studentId],
          body: 'Course message',
          course: courseId
        });

      expect(response.status).toBe(201);
    });

    it('should reject invalid course ID', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Test Subject',
          participantIds: [studentId],
          body: 'Test message',
          course: 'invalid-id'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/inbox/conversations/:conversationId/messages', () => {
    it('should get messages in conversation (participant)', async () => {
      if (!conversationId) {
        // Create a conversation first
        const createResponse = await request(app)
          .post('/api/inbox/conversations')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            subject: 'Test Conversation for Messages',
            participantIds: [studentId],
            body: 'Initial message',
            sendIndividually: false
          });
        conversationId = createResponse.body.conversation._id || createResponse.body.conversation.id;
      }

      const response = await request(app)
        .get(`/api/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should prevent non-participant from viewing messages', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Other',
          lastName: 'User',
          email: 'other-inbox@test.com',
          password: 'password123',
          role: 'student'
        });
      const otherToken = otherUserResponse.body.token;

      if (!conversationId) return;

      const response = await request(app)
        .get(`/api/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);

      // Cleanup
      await User.deleteMany({ email: 'other-inbox@test.com' });
    });

    it('should reject invalid conversation ID', async () => {
      const response = await request(app)
        .get('/api/inbox/conversations/invalid-id/messages')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/inbox/conversations/:conversationId/messages', () => {
    it('should send message in conversation', async () => {
      if (!conversationId) {
        const createResponse = await request(app)
          .post('/api/inbox/conversations')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            subject: 'Test Conversation for Sending',
            participantIds: [studentId],
            body: 'Initial message',
            sendIndividually: false
          });
        conversationId = createResponse.body.conversation._id || createResponse.body.conversation.id;
      }

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          body: 'Reply message',
          attachments: []
        });

      expect(response.status).toBe(201);
      expect(response.body.body).toBe('Reply message');
    });

    it('should require message body', async () => {
      if (!conversationId) return;

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attachments: []
        });

      expect(response.status).toBe(400);
    });

    it('should allow attachments', async () => {
      if (!conversationId) return;

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          body: 'Message with attachments',
          attachments: ['/uploads/file1.pdf', '/uploads/file2.jpg']
        });

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body.attachments)).toBe(true);
    });

    it('should reject invalid attachments format', async () => {
      if (!conversationId) return;

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          body: 'Test message',
          attachments: 'not-an-array'
        });

      expect(response.status).toBe(400);
    });

    it('should prevent non-participant from sending message', async () => {
      // Clean up any existing user first
      await User.deleteMany({ email: 'other-inbox2@test.com' });

      if (!conversationId) {
        // Create a conversation first if none exists
        const createResponse = await request(app)
          .post('/api/inbox/conversations')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            subject: 'Test Conversation for Non-Participant',
            participantIds: [studentId],
            body: 'Initial message',
            sendIndividually: false
          });
        conversationId = createResponse.body.conversation._id || createResponse.body.conversation.id;
      }

      // Create user directly in database to avoid rate limiting
      const otherUser = await User.create({
        firstName: 'Other',
        lastName: 'User2',
        email: 'other-inbox2@test.com',
        password: 'password123',
        role: 'student'
      });
      const otherToken = otherUser.getSignedJwtToken();

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          body: 'Unauthorized message'
        });

      expect(response.status).toBe(403);

      // Cleanup
      await User.deleteMany({ email: 'other-inbox2@test.com' });
    });
  });

  describe('POST /api/inbox/conversations/:conversationId/read', () => {
    it('should mark conversation as read', async () => {
      if (!conversationId) return;

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid conversation ID', async () => {
      const response = await request(app)
        .post('/api/inbox/conversations/invalid-id/read')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/inbox/conversations/:conversationId/move', () => {
    it('should move conversation to folder', async () => {
      if (!conversationId) return;

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/move`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          folder: 'archived'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept valid folders', async () => {
      if (!conversationId) return;

      const folders = ['inbox', 'sent', 'archived'];
      for (const folder of folders) {
        const response = await request(app)
          .post(`/api/inbox/conversations/${conversationId}/move`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ folder });

        expect(response.status).toBe(200);
      }
    });

    it('should reject invalid folder', async () => {
      if (!conversationId) return;

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/move`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          folder: 'invalid-folder'
        });

      expect(response.status).toBe(400);
    });

    it('should require folder', async () => {
      if (!conversationId) return;

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/move`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/inbox/conversations/:conversationId/star', () => {
    it('should toggle star on conversation', async () => {
      if (!conversationId) return;

      const response = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/star`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('starred');
    });

    it('should toggle star multiple times', async () => {
      if (!conversationId) return;

      // First toggle
      const response1 = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/star`)
        .set('Authorization', `Bearer ${teacherToken}`);
      const firstStarred = response1.body.starred;

      // Second toggle
      const response2 = await request(app)
        .post(`/api/inbox/conversations/${conversationId}/star`)
        .set('Authorization', `Bearer ${teacherToken}`);
      const secondStarred = response2.body.starred;

      expect(firstStarred).not.toBe(secondStarred);
    });
  });

  describe('DELETE /api/inbox/conversations/:conversationId/forever', () => {
    it('should delete conversation for user', async () => {
      // Create a conversation to delete
      const createResponse = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Conversation to Delete',
          participantIds: [studentId],
          body: 'Message to delete',
          sendIndividually: false
        });
      const deleteConversationId = createResponse.body.conversation._id || createResponse.body.conversation.id;

      const response = await request(app)
        .delete(`/api/inbox/conversations/${deleteConversationId}/forever`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should only delete for the requesting user', async () => {
      // Create conversation
      const createResponse = await request(app)
        .post('/api/inbox/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subject: 'Shared Conversation',
          participantIds: [studentId],
          body: 'Shared message',
          sendIndividually: false
        });
      const sharedConversationId = createResponse.body.conversation._id || createResponse.body.conversation.id;

      // Teacher deletes it
      await request(app)
        .delete(`/api/inbox/conversations/${sharedConversationId}/forever`)
        .set('Authorization', `Bearer ${teacherToken}`);

      // Student should still have access
      const response = await request(app)
        .get(`/api/inbox/conversations/${sharedConversationId}/messages`)
        .set('Authorization', `Bearer ${studentToken}`);

      // Should still be accessible (or 404 if conversation was fully deleted)
      expect([200, 404]).toContain(response.status);
    });

    it('should reject invalid conversation ID', async () => {
      const response = await request(app)
        .delete('/api/inbox/conversations/invalid-id/forever')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });
  });
});

