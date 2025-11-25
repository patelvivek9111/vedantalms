const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');

// Test database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Integration Tests - Course Management', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let courseId;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher@test.com', 'student@test.com'] } });
    await Course.deleteMany({ title: 'Test Course' });

    // Create teacher user
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Test',
        email: 'teacher@test.com',
        password: 'password123',
        role: 'teacher'
      });
    teacherToken = teacherResponse.body.token;
    teacherId = teacherResponse.body.user.id;

    // Create student user
    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Test',
        email: 'student@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher@test.com', 'student@test.com'] } });
    await Course.deleteMany({ title: 'Test Course' });
    
    // Close database connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Course Creation and Management', () => {
    it('should create a course as teacher', async () => {
      const response = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Course',
          description: 'This is a test course for integration testing',
          code: 'TEST101',
          defaultColor: '#3B82F6'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Course');
      courseId = response.body.data._id || response.body.data.id;
    });

    it('should get all courses', async () => {
      const response = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      // Response might be wrapped in success/data or be direct array
      const courses = response.body.data || response.body;
      expect(Array.isArray(courses)).toBe(true);
      expect(courses.length).toBeGreaterThan(0);
    });

    it('should get course by ID', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      const course = response.body.data || response.body;
      expect(course.title).toBe('Test Course');
    });

    it('should update course', async () => {
      const response = await request(app)
        .put(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Test Course',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      const course = response.body.data || response.body;
      expect(course.title).toBe('Updated Test Course');
    });

    it('should prevent student from creating course', async () => {
      const response = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Course',
          description: 'This should fail',
          code: 'STUD101'
        });

      expect(response.status).toBe(403);
    });
  });
});

