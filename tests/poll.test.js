const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Poll = require('../models/poll.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Polls API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let courseId;
  let pollId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-poll@test.com', 'student-poll@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Polls' });
    await Poll.deleteMany({ title: 'Test Poll' });

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Poll',
        email: 'teacher-poll@test.com',
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
        lastName: 'Poll',
        email: 'student-poll@test.com',
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
        title: 'Test Course for Polls',
        description: 'Course for testing polls',
        code: 'POL101'
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    // Enroll student in course
    await Course.findByIdAndUpdate(courseId, {
      $addToSet: { students: studentId }
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-poll@test.com', 'student-poll@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Polls' });
    await Poll.deleteMany({ title: 'Test Poll' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('POST /api/polls/courses/:courseId', () => {
    it('should create poll (teacher)', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const response = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Poll',
          options: ['Option 1', 'Option 2', 'Option 3'],
          endDate: endDate.toISOString(),
          allowMultipleVotes: false,
          resultsVisible: false
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Poll');
      pollId = response.body.data._id || response.body.data.id;
    });

    it('should prevent student from creating poll', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const response = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Poll',
          options: ['Option 1', 'Option 2'],
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(403);
    });

    it('should require title', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const response = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          options: ['Option 1', 'Option 2'],
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should require at least 2 options', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const response = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Poll',
          options: ['Option 1'],
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should require end date', async () => {
      const response = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Poll',
          options: ['Option 1', 'Option 2']
        });

      expect(response.status).toBe(400);
    });

    it('should reject end date in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const response = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Poll',
          options: ['Option 1', 'Option 2'],
          endDate: pastDate.toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid course ID', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const response = await request(app)
        .post('/api/polls/courses/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Poll',
          options: ['Option 1', 'Option 2'],
          endDate: endDate.toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should allow multiple votes when enabled', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const response = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Multiple Vote Poll',
          options: ['Option 1', 'Option 2', 'Option 3'],
          endDate: endDate.toISOString(),
          allowMultipleVotes: true
        });

      expect(response.status).toBe(201);
      expect(response.body.data.allowMultipleVotes).toBe(true);
    });
  });

  describe('GET /api/polls/courses/:courseId', () => {
    it('should get polls for course (teacher)', async () => {
      const response = await request(app)
        .get(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get polls for course (student)', async () => {
      const response = await request(app)
        .get(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should hide results from student until they vote', async () => {
      if (!pollId) {
        // Create a poll first
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        const createResponse = await request(app)
          .post(`/api/polls/courses/${courseId}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Hidden Results Poll',
            options: ['Option 1', 'Option 2'],
            endDate: endDate.toISOString()
          });
        pollId = createResponse.body.data._id || createResponse.body.data.id;
      }

      const response = await request(app)
        .get(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      const poll = response.body.data.find(p => (p._id || p.id) === pollId);
      if (poll && !poll.hasVoted && !poll.isExpired) {
        // Results should be hidden
        expect(poll.options[0].votes).toBeUndefined();
      }
    });

    it('should reject invalid course ID', async () => {
      const response = await request(app)
        .get('/api/polls/courses/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should prevent unauthorized access to course polls', async () => {
      // Create another teacher and course
      const otherTeacherResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Other',
          lastName: 'Teacher',
          email: 'other-teacher-poll@test.com',
          password: 'password123',
          role: 'teacher'
        });
      const otherTeacherToken = otherTeacherResponse.body.token;

      const otherCourseResponse = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          title: 'Other Course',
          description: 'Other course',
          code: 'OTH101'
        });
      const otherCourseId = otherCourseResponse.body.data._id || otherCourseResponse.body.data.id;

      // Student should not access other course polls
      const response = await request(app)
        .get(`/api/polls/courses/${otherCourseId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);

      // Cleanup
      await User.deleteMany({ email: 'other-teacher-poll@test.com' });
      await Course.deleteMany({ title: 'Other Course' });
    });
  });

  describe('POST /api/polls/:pollId/vote', () => {
    it('should allow student to vote on poll', async () => {
      if (!pollId) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        const createResponse = await request(app)
          .post(`/api/polls/courses/${courseId}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Vote Test Poll',
            options: ['Option 1', 'Option 2'],
            endDate: endDate.toISOString()
          });
        pollId = createResponse.body.data._id || createResponse.body.data.id;
      }

      const response = await request(app)
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: [0]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent teacher from voting', async () => {
      if (!pollId) return;

      const response = await request(app)
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          selectedOptions: [0]
        });

      expect(response.status).toBe(403);
    });

    it('should require at least one option', async () => {
      if (!pollId) return;

      const response = await request(app)
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: []
        });

      expect(response.status).toBe(400);
    });

    it('should prevent voting on expired poll', async () => {
      // Create a poll with future endDate first (to pass validation)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const poll = new Poll({
        course: courseId,
        title: 'Poll to Expire',
        options: [{ text: 'Option 1', votes: 0 }, { text: 'Option 2', votes: 0 }],
        createdBy: teacherId,
        endDate: futureDate,
        isActive: true
      });
      await poll.save();

      // Manually update endDate to past (bypassing validation)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await Poll.findByIdAndUpdate(poll._id, { endDate: pastDate }, { runValidators: false });

      // Refresh the poll to get updated endDate
      const expiredPoll = await Poll.findById(poll._id);

      const response = await request(app)
        .post(`/api/polls/${expiredPoll._id}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: [0]
        });

      expect(response.status).toBe(400);

      // Cleanup
      await Poll.findByIdAndDelete(expiredPoll._id);
    });

    it('should prevent duplicate votes when multiple votes not allowed', async () => {
      if (!pollId) return;

      // Vote once
      await request(app)
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: [0]
        });

      // Try to vote again
      const response = await request(app)
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: [1]
        });

      expect(response.status).toBe(400);
    });

    it('should allow multiple votes when enabled', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      const createResponse = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Multiple Vote Test Poll',
          options: ['Option 1', 'Option 2', 'Option 3'],
          endDate: endDate.toISOString(),
          allowMultipleVotes: true
        });
      const multiPollId = createResponse.body.data._id || createResponse.body.data.id;

      // Vote first time
      await request(app)
        .post(`/api/polls/${multiPollId}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: [0]
        });

      // Vote second time (should be allowed)
      const response = await request(app)
        .post(`/api/polls/${multiPollId}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: [1]
        });

      expect(response.status).toBe(200);
    });

    it('should reject invalid option index', async () => {
      if (!pollId) return;

      const response = await request(app)
        .post(`/api/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: [999] // Invalid index
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid poll ID', async () => {
      const response = await request(app)
        .post('/api/polls/invalid-id/vote')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          selectedOptions: [0]
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/polls/:pollId/results', () => {
    it('should get poll results (teacher)', async () => {
      if (!pollId) return;

      const response = await request(app)
        .get(`/api/polls/${pollId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should prevent student from viewing detailed results', async () => {
      if (!pollId) return;

      const response = await request(app)
        .get(`/api/polls/${pollId}/results`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject invalid poll ID', async () => {
      const response = await request(app)
        .get('/api/polls/invalid-id/results')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent poll', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/polls/${fakeId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/polls/:pollId', () => {
    it('should update poll (teacher)', async () => {
      if (!pollId) return;

      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 14);

      const response = await request(app)
        .put(`/api/polls/${pollId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Poll Title',
          endDate: newEndDate.toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent student from updating poll', async () => {
      if (!pollId) return;

      const response = await request(app)
        .put(`/api/polls/${pollId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
    });

    it('should reject empty title', async () => {
      if (!pollId) return;

      const response = await request(app)
        .put(`/api/polls/${pollId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: ''
        });

      expect(response.status).toBe(400);
    });

    it('should reject end date in the past', async () => {
      if (!pollId) return;

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const response = await request(app)
        .put(`/api/polls/${pollId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          endDate: pastDate.toISOString()
        });

      expect(response.status).toBe(400);
    });

    it('should allow updating isActive status', async () => {
      if (!pollId) return;

      const response = await request(app)
        .put(`/api/polls/${pollId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          isActive: false
        });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/polls/:pollId', () => {
    it('should delete poll (teacher)', async () => {
      // Create poll to delete
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      const createResponse = await request(app)
        .post(`/api/polls/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Poll to Delete',
          options: ['Option 1', 'Option 2'],
          endDate: endDate.toISOString()
        });
      const deletePollId = createResponse.body.data._id || createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/polls/${deletePollId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent student from deleting poll', async () => {
      if (!pollId) return;

      const response = await request(app)
        .delete(`/api/polls/${pollId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject invalid poll ID', async () => {
      const response = await request(app)
        .delete('/api/polls/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent poll', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/polls/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });
});

