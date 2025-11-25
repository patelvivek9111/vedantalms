const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Module API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let courseId;
  let moduleId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-module@test.com', 'student-module@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Modules' });
    await Module.deleteMany({ title: 'Test Module' });

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Module',
        email: 'teacher-module@test.com',
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
        lastName: 'Module',
        email: 'student-module@test.com',
        password: 'password123',
        role: 'student'
      });
    studentToken = studentResponse.body.token;

    // Create course
    const courseResponse = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Course for Modules',
        description: 'Course for testing modules',
        code: 'MOD101'
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-module@test.com', 'student-module@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Modules' });
    await Module.deleteMany({ title: 'Test Module' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('POST /api/modules', () => {
    it('should create module', async () => {
      const response = await request(app)
        .post('/api/modules')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Module',
          description: 'Test module description',
          course: courseId,
          order: 1
        });

      expect(response.status).toBe(201);
      const module = response.body.data || response.body;
      expect(module.title).toBe('Test Module');
      moduleId = module._id || module.id;
    });

    it('should reject module creation without title', async () => {
      const response = await request(app)
        .post('/api/modules')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          description: 'No title',
          course: courseId
        });

      expect(response.status).toBe(400);
    });

    it('should prevent student from creating module', async () => {
      const response = await request(app)
        .post('/api/modules')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Module',
          course: courseId
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/modules/:courseId', () => {
    it('should get modules for course', async () => {
      const response = await request(app)
        .get(`/api/modules/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      const modules = response.body.data || response.body;
      expect(Array.isArray(modules)).toBe(true);
    });

    it('should allow student to view modules', async () => {
      const response = await request(app)
        .get(`/api/modules/${courseId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/modules/:id', () => {
    it('should get module by ID', async () => {
      if (!moduleId) {
        // Create module if not exists
        const createResponse = await request(app)
          .post('/api/modules')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Test Module for Get',
            course: courseId
          });
        moduleId = createResponse.body.data._id || createResponse.body.data.id;
      }

      const response = await request(app)
        .get(`/api/modules/view/${moduleId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      const module = response.body.data || response.body;
      expect(module._id.toString()).toBe(moduleId.toString());
    });
  });

  describe('PUT /api/modules/:id', () => {
    it('should update module', async () => {
      if (!moduleId) return;

      const response = await request(app)
        .put(`/api/modules/${moduleId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Module Title'
        });

      expect(response.status).toBe(200);
      const module = response.body.data || response.body;
      expect(module.title).toBe('Updated Module Title');
    });

    it('should prevent student from updating module', async () => {
      if (!moduleId) return;

      const response = await request(app)
        .put(`/api/modules/${moduleId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Update'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/modules/:id', () => {
    it('should delete module', async () => {
      // Create a module to delete
      const createResponse = await request(app)
        .post('/api/modules')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Module to Delete',
          course: courseId
        });
      const deleteModuleId = createResponse.body.data._id || createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/modules/${deleteModuleId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Verify module is deleted
      const getResponse = await request(app)
        .get(`/api/modules/view/${deleteModuleId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(getResponse.status).toBe(404);
    });

    it('should prevent student from deleting module', async () => {
      if (!moduleId) return;

      const response = await request(app)
        .delete(`/api/modules/${moduleId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });
});

