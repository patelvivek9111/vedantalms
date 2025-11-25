const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Announcement = require('../models/announcement.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Announcements API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let courseId;
  let announcementId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-ann@test.com', 'student-ann@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Announcements' });
    await Announcement.deleteMany({ title: 'Test Announcement' });

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Ann',
        email: 'teacher-ann@test.com',
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
        lastName: 'Ann',
        email: 'student-ann@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;

    // Create course
    const courseResponse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Course for Announcements',
        description: 'Course for testing announcements',
        code: 'ANN101'
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-ann@test.com', 'student-ann@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Announcements' });
    await Announcement.deleteMany({ title: 'Test Announcement' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('POST /api/courses/:courseId/announcements', () => {
    it('should create announcement (teacher)', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/announcements`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Announcement',
          body: 'Test announcement content',
          postTo: 'all'
        });

      expect(response.status).toBe(201);
      const announcement = response.body.data || response.body;
      expect(announcement.title).toBe('Test Announcement');
      announcementId = announcement._id || announcement.id;
    });

    it('should prevent student from creating announcement', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/announcements`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Announcement',
          body: 'Content',
          postTo: 'all'
        });

      expect(response.status).toBe(403);
    });

    it('should reject announcement creation without title', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/announcements`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          body: 'No title',
          postTo: 'all'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/courses/:courseId/announcements', () => {
    it('should get announcements for course', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/announcements`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      const announcements = response.body.data || response.body;
      expect(Array.isArray(announcements)).toBe(true);
    });

    it('should allow student to view announcements', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/announcements`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/announcements/:id/comments', () => {
    it('should get announcement comments (which verifies announcement exists)', async () => {
      if (!announcementId) {
        // Create announcement if not exists
        const createResponse = await request(app)
          .post(`/api/courses/${courseId}/announcements`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Test Announcement for Get',
            body: 'Content',
            postTo: 'all'
          });
        announcementId = createResponse.body.data._id || createResponse.body.data.id;
      }

      // Get announcement via comments endpoint (announcement must exist)
      const response = await request(app)
        .get(`/api/announcements/${announcementId}/comments`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      // If we get comments, announcement exists
      const comments = response.body.data || response.body;
      expect(Array.isArray(comments)).toBe(true);
    });
  });

  describe('PUT /api/announcements/:id', () => {
    it('should update announcement (teacher)', async () => {
      if (!announcementId) return;

      const response = await request(app)
        .put(`/api/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Announcement Title'
        });

      expect(response.status).toBe(200);
      const announcement = response.body.data || response.body;
      expect(announcement.title).toBe('Updated Announcement Title');
    });

    it('should prevent student from updating announcement', async () => {
      if (!announcementId) return;

      const response = await request(app)
        .put(`/api/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Update'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/announcements/:id', () => {
    it('should delete announcement (teacher)', async () => {
      // Create an announcement to delete
      const createResponse = await request(app)
        .post(`/api/courses/${courseId}/announcements`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Announcement to Delete',
          body: 'Content',
          postTo: 'all'
        });
      const deleteAnnouncementId = createResponse.body.data._id || createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/announcements/${deleteAnnouncementId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Verify announcement is deleted
      const getResponse = await request(app)
        .get(`/api/announcements/${deleteAnnouncementId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(getResponse.status).toBe(404);
    });

    it('should prevent student from deleting announcement', async () => {
      if (!announcementId) return;

      const response = await request(app)
        .delete(`/api/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });
});

