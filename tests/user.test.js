const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('User API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let courseId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-user@test.com', 'student-user@test.com', 'search-user@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for User' });

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'User',
        email: 'teacher-user@test.com',
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
        lastName: 'User',
        email: 'student-user@test.com',
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
        title: 'Test Course for User',
        description: 'Course for testing user',
        code: 'USR101'
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    // Create user for search tests
    await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Search',
        lastName: 'User',
        email: 'search-user@test.com',
        password: 'password123',
        role: 'student'
      });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-user@test.com', 'student-user@test.com', 'search-user@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for User' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/users/search', () => {
    it('should search users by email (teacher)', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ email: 'search-user@test.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ name: 'Search' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter by role', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ role: 'student' });

      expect(response.status).toBe(200);
      expect(response.body.data.every(u => u.role === 'student')).toBe(true);
    });

    it('should filter by course', async () => {
      // Enroll search user in course
      const searchUser = await User.findOne({ email: 'search-user@test.com' });
      if (searchUser) {
        await Course.findByIdAndUpdate(courseId, {
          $addToSet: { students: searchUser._id }
        });
      }

      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ email: 'search-user@test.com', courseId: courseId });

      expect(response.status).toBe(200);
    });

    it('should require at least one search parameter', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should prevent student from searching users', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ email: 'test@test.com' });

      expect(response.status).toBe(403);
    });

    it('should reject invalid course ID', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ email: 'test@test.com', courseId: 'invalid-id' });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/users/me', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          bio: 'Updated bio'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.firstName).toBe('Updated');
      expect(response.body.user.lastName).toBe('Name');
    });

    it('should allow partial update', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          firstName: 'Partially Updated'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.firstName).toBe('Partially Updated');
    });

    it('should reject empty firstName', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          firstName: ''
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty lastName', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          lastName: ''
        });

      expect(response.status).toBe(400);
    });

    it('should allow updating bio', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          bio: 'New bio text'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.bio).toBe('New bio text');
    });

    it('should allow clearing bio', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          bio: null
        });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/users/me/profile-picture', () => {
    it('should require file upload', async () => {
      const response = await request(app)
        .post('/api/users/me/profile-picture')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(400);
    });

    // Note: File upload tests would require actual file creation
    // This is a basic test to ensure the endpoint exists and validates input
  });

  describe('GET /api/users/me/preferences', () => {
    it('should get user preferences', async () => {
      const response = await request(app)
        .get('/api/users/me/preferences')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.preferences).toBeDefined();
    });

    it('should return default preferences if none exist', async () => {
      // Clean up any existing user first
      await User.deleteMany({ email: 'new-user-pref@test.com' });

      // Create new user directly in database to avoid rate limiting
      const newUser = await User.create({
        firstName: 'New',
        lastName: 'User',
        email: 'new-user-pref@test.com',
        password: 'password123',
        role: 'student'
      });
      const newToken = newUser.getSignedJwtToken();

      const response = await request(app)
        .get('/api/users/me/preferences')
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(200);
      expect(response.body.preferences).toBeDefined();

      // Cleanup
      await User.deleteMany({ email: 'new-user-pref@test.com' });
    });
  });

  describe('PUT /api/users/me/preferences', () => {
    it('should update user preferences', async () => {
      const response = await request(app)
        .put('/api/users/me/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          language: 'en',
          timeZone: 'America/New_York',
          theme: 'dark',
          showOnlineStatus: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.preferences.language).toBe('en');
      expect(response.body.preferences.theme).toBe('dark');
    });

    it('should update course colors', async () => {
      const response = await request(app)
        .put('/api/users/me/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseColors: {
            [courseId]: '#FF5733'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.preferences.courseColors).toBeDefined();
    });

    it('should allow partial update', async () => {
      const response = await request(app)
        .put('/api/users/me/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          theme: 'light'
        });

      expect(response.status).toBe(200);
      expect(response.body.preferences.theme).toBe('light');
    });
  });

  describe('PUT /api/users/me/password', () => {
    it('should update password', async () => {
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student-user@test.com',
          password: 'newpassword123'
        });

      expect(loginResponse.status).toBe(200);

      // Reset password for other tests
      await User.findByIdAndUpdate(studentId, { password: 'password123' });
    });

    it('should require all password fields', async () => {
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
    });

    it('should require matching new and confirm passwords', async () => {
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
          confirmPassword: 'differentpassword'
        });

      expect(response.status).toBe(400);
    });

    it('should require minimum password length', async () => {
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'short',
          confirmPassword: 'short'
        });

      expect(response.status).toBe(400);
    });

    it('should require different new password', async () => {
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'password123',
          confirmPassword: 'password123'
        });

      expect(response.status).toBe(400);
    });

    it('should verify current password', async () => {
      const response = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
    });
  });
});

