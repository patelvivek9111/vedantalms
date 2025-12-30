const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Reports API', () => {
  let studentToken;
  let studentId;
  let teacherToken;
  let courseId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['student-report@test.com', 'teacher-report@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Reports' });

    // Create student
    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Report',
        email: 'student-report@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;
    studentId = studentResponse.body.user.id;

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Report',
        email: 'teacher-report@test.com',
        password: 'password123',
        role: 'teacher'
      });
    teacherToken = teacherResponse.body.token;

    // Create course with semester
    const courseResponse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Course for Reports',
        description: 'Course for testing reports',
        code: 'RPT101',
        semester: {
          term: 'Fall',
          year: 2024
        },
        published: true
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    // Enroll student in course
    await Course.findByIdAndUpdate(courseId, {
      $addToSet: { students: studentId }
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['student-report@test.com', 'teacher-report@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Reports' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/reports/semesters', () => {
    it('should get available semesters (student)', async () => {
      const response = await request(app)
        .get('/api/reports/semesters')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return semesters with correct format', async () => {
      const response = await request(app)
        .get('/api/reports/semesters')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('term');
        expect(response.body.data[0]).toHaveProperty('year');
        expect(['Fall', 'Spring', 'Summer', 'Winter']).toContain(response.body.data[0].term);
      }
    });

    it('should prevent teacher from accessing', async () => {
      const response = await request(app)
        .get('/api/reports/semesters')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });

    it('should handle courses without semester info', async () => {
      // Create course without semester
      const courseResponse = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Course Without Semester',
          description: 'Course without semester',
          code: 'NOSEM101',
          published: true
        });
      const noSemCourseId = courseResponse.body.data._id || courseResponse.body.data.id;

      // Enroll student
      await Course.findByIdAndUpdate(noSemCourseId, {
        $addToSet: { students: studentId }
      });

      const response = await request(app)
        .get('/api/reports/semesters')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      // Should still work, using default semester based on creation date

      // Cleanup
      await Course.findByIdAndDelete(noSemCourseId);
    });
  });

  describe('GET /api/reports/transcript', () => {
    it('should get student transcript (student)', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          term: 'Fall',
          year: '2024'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('courses');
      expect(response.body.data).toHaveProperty('totalCredits');
    });

    it('should require term parameter', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          year: '2024'
        });

      expect(response.status).toBe(400);
    });

    it('should require year parameter', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          term: 'Fall'
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid term', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          term: 'InvalidTerm',
          year: '2024'
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid year (too low)', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          term: 'Fall',
          year: '1999'
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid year (too high)', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          term: 'Fall',
          year: '2101'
        });

      expect(response.status).toBe(400);
    });

    it('should reject non-numeric year', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          term: 'Fall',
          year: 'not-a-number'
        });

      expect(response.status).toBe(400);
    });

    it('should prevent teacher from accessing', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          term: 'Fall',
          year: '2024'
        });

      expect(response.status).toBe(403);
    });

    it('should return empty courses array for semester with no courses', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          term: 'Spring',
          year: '2025'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.courses).toEqual([]);
      expect(response.body.data.totalCredits).toBe(0);
    });

    it('should include course details in transcript', async () => {
      const response = await request(app)
        .get('/api/reports/transcript')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({
          term: 'Fall',
          year: '2024'
        });

      expect(response.status).toBe(200);
      if (response.body.data.courses.length > 0) {
        const course = response.body.data.courses[0];
        expect(course).toHaveProperty('courseId');
        expect(course).toHaveProperty('courseTitle');
        expect(course).toHaveProperty('courseCode');
        expect(course).toHaveProperty('creditHours');
        expect(course).toHaveProperty('finalGrade');
        expect(course).toHaveProperty('letterGrade');
        expect(course).toHaveProperty('semester');
      }
    });
  });
});

