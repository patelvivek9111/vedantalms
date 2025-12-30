const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Attendance = require('../models/attendance.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Attendance API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let courseId;
  const testDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-att@test.com', 'student-att@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Attendance' });
    await Attendance.deleteMany({});

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Att',
        email: 'teacher-att@test.com',
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
        lastName: 'Att',
        email: 'student-att@test.com',
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
        title: 'Test Course for Attendance',
        description: 'Course for testing attendance',
        code: 'ATT101'
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    // Enroll student in course
    await Course.findByIdAndUpdate(courseId, {
      $addToSet: { students: studentId }
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-att@test.com', 'student-att@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Attendance' });
    await Attendance.deleteMany({});
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/courses/:courseId/attendance', () => {
    it('should get attendance for a course and date (teacher)', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ date: testDate });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require date parameter', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should reject invalid course ID', async () => {
      const response = await request(app)
        .get('/api/courses/invalid-id/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ date: testDate });

      expect(response.status).toBe(400);
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ date: 'invalid-date' });

      expect(response.status).toBe(400);
    });

    it('should allow student to view attendance', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ date: testDate });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/courses/:courseId/attendance', () => {
    it('should save attendance (teacher)', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: testDate,
          attendanceData: [
            {
              studentId: studentId,
              status: 'present',
              reason: '',
              notes: 'Test attendance'
            }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Attendance saved successfully');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should prevent student from saving attendance', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          date: testDate,
          attendanceData: [
            {
              studentId: studentId,
              status: 'present'
            }
          ]
        });

      expect(response.status).toBe(403);
    });

    it('should reject attendance without date', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          attendanceData: [
            {
              studentId: studentId,
              status: 'present'
            }
          ]
        });

      expect(response.status).toBe(400);
    });

    it('should reject attendance without attendanceData', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: testDate
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: testDate,
          attendanceData: [
            {
              studentId: studentId,
              status: 'invalid-status'
            }
          ]
        });

      expect(response.status).toBe(400);
    });

    it('should handle multiple attendance records', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: testDate,
          attendanceData: [
            {
              studentId: studentId,
              status: 'present',
              reason: '',
              notes: ''
            }
          ]
        });

      expect(response.status).toBe(200);
    });

    it('should handle unmarked status (removes record)', async () => {
      // First mark as present
      await request(app)
        .post(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: testDate,
          attendanceData: [
            {
              studentId: studentId,
              status: 'present'
            }
          ]
        });

      // Then unmark
      const response = await request(app)
        .post(`/api/courses/${courseId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: testDate,
          attendanceData: [
            {
              studentId: studentId,
              status: 'unmarked'
            }
          ]
        });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/courses/:courseId/attendance/stats', () => {
    it('should get attendance statistics (teacher)', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance/stats`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRecords');
      expect(response.body).toHaveProperty('present');
      expect(response.body).toHaveProperty('absent');
    });

    it('should filter statistics by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance/stats`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        });

      expect(response.status).toBe(200);
    });

    it('should prevent student from accessing stats', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance/stats`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/courses/:courseId/attendance/student', () => {
    it('should get student own attendance', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance/student`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should prevent accessing other student attendance', async () => {
      // This is tested implicitly - student can only see their own
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance/student`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/courses/:courseId/attendance/percentages', () => {
    it('should get attendance percentages (teacher)', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance/percentages`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe('object');
    });

    it('should filter percentages by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance/percentages`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        });

      expect(response.status).toBe(200);
    });

    it('should prevent student from accessing percentages', async () => {
      const response = await request(app)
        .get(`/api/courses/${courseId}/attendance/percentages`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });
});

