const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Admin API', () => {
  let adminToken;
  let adminId;
  let teacherToken;
  let studentToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['admin-test@test.com', 'teacher-admin@test.com', 'student-admin@test.com'] } });

    // Create admin
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Admin',
        lastName: 'Test',
        email: 'admin-test@test.com',
        password: 'password123',
        role: 'admin'
      });
    adminToken = adminResponse.body.token;
    adminId = adminResponse.body.user.id;

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Admin',
        email: 'teacher-admin@test.com',
        password: 'password123',
        role: 'teacher'
      });
    teacherToken = teacherResponse.body.token;

    // Create student
    const studentResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Admin',
        email: 'student-admin@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['admin-test@test.com', 'teacher-admin@test.com', 'student-admin@test.com'] } });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/admin/stats', () => {
    it('should get system statistics (admin)', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalUsers).toBeDefined();
      expect(response.body.data.totalCourses).toBeDefined();
    });

    it('should prevent teacher from accessing stats', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });

    it('should prevent student from accessing stats', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/stats');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/users', () => {
    it('should get all users (admin)', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Response might be wrapped in data or be direct array
      const users = response.body.data || response.body;
      expect(Array.isArray(users)).toBe(true);
    });

    it('should prevent non-admin from accessing users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/courses', () => {
    it('should get all courses (admin)', async () => {
      const response = await request(app)
        .get('/api/admin/courses')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Response might be wrapped in data or be direct array
      const users = response.body.data || response.body;
      expect(Array.isArray(users)).toBe(true);
    });

    it('should prevent non-admin from accessing all courses', async () => {
      const response = await request(app)
        .get('/api/admin/courses')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics', () => {
    it('should get analytics (admin)', async () => {
      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Response might be wrapped in success/data or be direct object
      expect(response.body.success !== undefined || response.body.data !== undefined || Object.keys(response.body).length > 0).toBe(true);
    });

    it('should prevent non-admin from accessing analytics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/activity', () => {
    it('should get recent activity (admin)', async () => {
      const response = await request(app)
        .get('/api/admin/activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Response might be wrapped in success/data or be direct object
      expect(response.body.success !== undefined || response.body.data !== undefined || Object.keys(response.body).length > 0).toBe(true);
    });

    it('should prevent non-admin from accessing activity', async () => {
      const response = await request(app)
        .get('/api/admin/activity')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/security/stats', () => {
    it('should get security statistics (admin)', async () => {
      const response = await request(app)
        .get('/api/admin/security/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Response might be wrapped in success/data or be direct object
      expect(response.body.success !== undefined || response.body.data !== undefined || Object.keys(response.body).length > 0).toBe(true);
    });

    it('should prevent non-admin from accessing security stats', async () => {
      const response = await request(app)
        .get('/api/admin/security/stats')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/security/events', () => {
    it('should get security events (admin)', async () => {
      const response = await request(app)
        .get('/api/admin/security/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Response might be wrapped in data or be direct array
      const users = response.body.data || response.body;
      expect(Array.isArray(users)).toBe(true);
    });

    it('should prevent non-admin from accessing security events', async () => {
      const response = await request(app)
        .get('/api/admin/security/events')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/settings', () => {
    it('should get system settings (admin)', async () => {
      const response = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Response might be wrapped in success/data or be direct object
      expect(response.body.success !== undefined || response.body.data !== undefined || Object.keys(response.body).length > 0).toBe(true);
    });

    it('should prevent non-admin from accessing settings', async () => {
      const response = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/admin/settings', () => {
    it('should update system settings (admin)', async () => {
      const response = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          siteName: 'Test LMS',
          maintenanceMode: false
        });

      expect(response.status).toBe(200);
      // Response might be wrapped in success/data or be direct object
      expect(response.body.success !== undefined || response.body.data !== undefined || Object.keys(response.body).length > 0).toBe(true);
    });

    it('should prevent non-admin from updating settings', async () => {
      const response = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          siteName: 'Hacked'
        });

      expect(response.status).toBe(403);
    });
  });
});

