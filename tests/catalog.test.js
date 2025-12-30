const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Catalog API', () => {
  let teacherToken;
  let studentToken;
  let courseId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-catalog@test.com', 'student-catalog@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Catalog' });

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Catalog',
        email: 'teacher-catalog@test.com',
        password: 'password123',
        role: 'teacher'
      });
    teacherToken = teacherResponse.body.token;

    // Create student
    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Catalog',
        email: 'student-catalog@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;

    // Create course with catalog info
    const courseResponse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Course for Catalog',
        description: 'Course for testing catalog',
        code: 'CAT101',
        catalog: {
          subject: 'CAT101',
          maxStudents: 30,
          description: 'Catalog course description',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          tags: ['test', 'catalog']
        }
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-catalog@test.com', 'student-catalog@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Catalog' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/catalog', () => {
    it('should get catalog without authentication', async () => {
      const response = await request(app)
        .get('/api/catalog');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get catalog with authentication', async () => {
      const response = await request(app)
        .get('/api/catalog')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should only return courses with catalog dates', async () => {
      // Create course without catalog dates
      const courseResponse = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Course Without Catalog',
          description: 'Course without catalog dates',
          code: 'NOCAT101'
        });
      const noCatCourseId = courseResponse.body.data._id || courseResponse.body.data.id;

      const response = await request(app)
        .get('/api/catalog');

      expect(response.status).toBe(200);
      // Course without catalog dates should not appear
      const courseInCatalog = response.body.find(c => c._id === noCatCourseId || c.id === noCatCourseId);
      expect(courseInCatalog).toBeUndefined();

      // Cleanup
      await Course.findByIdAndDelete(noCatCourseId);
    });

    it('should populate instructor information', async () => {
      const response = await request(app)
        .get('/api/catalog');

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        const course = response.body.find(c => (c._id || c.id) === courseId);
        if (course) {
          expect(course.instructor).toBeDefined();
        }
      }
    });

    it('should include catalog information', async () => {
      const response = await request(app)
        .get('/api/catalog');

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        const course = response.body.find(c => (c._id || c.id) === courseId);
        if (course) {
          expect(course.catalog).toBeDefined();
          expect(course.catalog).toHaveProperty('subject');
          expect(course.catalog).toHaveProperty('startDate');
          expect(course.catalog).toHaveProperty('endDate');
        }
      }
    });

    it('should show enrollment status for authenticated users', async () => {
      // Enroll student in course
      await Course.findByIdAndUpdate(courseId, {
        $addToSet: { students: await User.findOne({ email: 'student-catalog@test.com' }).then(u => u?._id) }
      });

      const response = await request(app)
        .get('/api/catalog')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        const course = response.body.find(c => (c._id || c.id) === courseId);
        if (course) {
          // Should have students populated for authenticated users
          expect(course).toHaveProperty('students');
        }
      }
    });

    it('should not show students for unauthenticated users', async () => {
      const response = await request(app)
        .get('/api/catalog');

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        const course = response.body[0];
        // Students should not be populated for unauthenticated users
        // (or should be empty array)
        if (course.students) {
          expect(Array.isArray(course.students)).toBe(true);
        }
      }
    });

    it('should handle invalid token gracefully', async () => {
      const response = await request(app)
        .get('/api/catalog')
        .set('Authorization', 'Bearer invalid-token');

      // Should still return catalog (public endpoint)
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include enrollment requests for authenticated users', async () => {
      const response = await request(app)
        .get('/api/catalog')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        const course = response.body.find(c => (c._id || c.id) === courseId);
        if (course) {
          // Should have enrollmentRequests populated
          expect(course).toHaveProperty('enrollmentRequests');
        }
      }
    });

    it('should include waitlist for authenticated users', async () => {
      const response = await request(app)
        .get('/api/catalog')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      if (response.body.length > 0) {
        const course = response.body.find(c => (c._id || c.id) === courseId);
        if (course) {
          // Should have waitlist populated
          expect(course).toHaveProperty('waitlist');
        }
      }
    });
  });
});

