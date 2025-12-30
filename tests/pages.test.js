const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Page = require('../models/page.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Pages API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let courseId;
  let moduleId;
  let pageId;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-page@test.com', 'student-page@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Pages' });
    await Module.deleteMany({ title: 'Test Module for Pages' });
    await Page.deleteMany({ title: 'Test Page' });

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Page',
        email: 'teacher-page@test.com',
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
        lastName: 'Page',
        email: 'student-page@test.com',
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
        title: 'Test Course for Pages',
        description: 'Course for testing pages',
        code: 'PAG101'
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    // Create module
    const moduleResponse = await request(app)
      .post('/api/modules')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        course: courseId,
        title: 'Test Module for Pages',
        description: 'Module for testing pages'
      });
    expect(moduleResponse.status).toBe(201);
    moduleId = moduleResponse.body.data._id || moduleResponse.body.data.id;

    // Enroll student in course
    await Course.findByIdAndUpdate(courseId, {
      $addToSet: { students: studentId }
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-page@test.com', 'student-page@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Pages' });
    await Module.deleteMany({ title: 'Test Module for Pages' });
    await Page.deleteMany({ title: 'Test Page' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('POST /api/pages', () => {
    it('should create page (teacher)', async () => {
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Page',
          module: moduleId,
          content: 'Test page content'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Page');
      pageId = response.body.data._id || response.body.data.id;
    });

    it('should prevent student from creating page', async () => {
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Page',
          module: moduleId,
          content: 'Student content'
        });

      expect(response.status).toBe(403);
    });

    it('should require title', async () => {
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          module: moduleId,
          content: 'Test content'
        });

      expect(response.status).toBe(400);
    });

    it('should require content', async () => {
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Page',
          module: moduleId
        });

      expect(response.status).toBe(400);
    });

    it('should require module or groupSet', async () => {
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Page',
          content: 'Test content'
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid module ID', async () => {
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Page',
          module: 'invalid-id',
          content: 'Test content'
        });

      expect(response.status).toBe(400);
    });

    it('should prevent creating page in unauthorized module', async () => {
      // Clean up any existing test data first
      await User.deleteMany({ email: 'other-teacher-page@test.com' });
      await Course.deleteMany({ title: 'Other Course' });
      await Module.deleteMany({ title: 'Other Module' });

      // Create another teacher and course
      const otherTeacherResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Other',
          lastName: 'Teacher',
          email: 'other-teacher-page@test.com',
          password: 'password123',
          role: 'teacher'
        });
      expect(otherTeacherResponse.status).toBe(201);
      const otherTeacherToken = otherTeacherResponse.body.token;

      const otherCourseResponse = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          title: 'Other Course',
          description: 'Other course',
          code: 'OTH101'
        });
      expect(otherCourseResponse.status).toBe(201);
      const otherCourseId = otherCourseResponse.body.data._id || otherCourseResponse.body.data.id;

      const otherModuleResponse = await request(app)
        .post('/api/modules')
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          course: otherCourseId,
          title: 'Other Module',
          description: 'Other module'
        });
      expect(otherModuleResponse.status).toBe(201);
      const otherModuleId = otherModuleResponse.body.data._id || otherModuleResponse.body.data.id;

      // Try to create page in other teacher's module
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Unauthorized Page',
          module: otherModuleId,
          content: 'Unauthorized content'
        });

      expect(response.status).toBe(403);

      // Cleanup
      await User.deleteMany({ email: 'other-teacher-page@test.com' });
      await Course.deleteMany({ title: 'Other Course' });
      await Module.deleteMany({ title: 'Other Module' });
    });
  });

  describe('GET /api/pages/:moduleId', () => {
    it('should get pages by module (teacher)', async () => {
      const response = await request(app)
        .get(`/api/pages/${moduleId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get pages by module (student)', async () => {
      const response = await request(app)
        .get(`/api/pages/${moduleId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid module ID', async () => {
      const response = await request(app)
        .get('/api/pages/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent module', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/pages/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/pages/view/:id', () => {
    it('should get page by ID', async () => {
      if (!pageId) return;

      const response = await request(app)
        .get(`/api/pages/view/${pageId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should allow student to view page', async () => {
      if (!pageId) return;

      const response = await request(app)
        .get(`/api/pages/view/${pageId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject invalid page ID', async () => {
      const response = await request(app)
        .get('/api/pages/view/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent page', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/pages/view/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/pages/:id', () => {
    it('should update page (teacher)', async () => {
      if (!pageId) return;

      const response = await request(app)
        .put(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Page Title',
          content: 'Updated content'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Page Title');
    });

    it('should prevent student from updating page', async () => {
      if (!pageId) return;

      const response = await request(app)
        .put(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
    });

    it('should reject empty title', async () => {
      if (!pageId) return;

      const response = await request(app)
        .put(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: ''
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty content', async () => {
      if (!pageId) return;

      const response = await request(app)
        .put(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          content: ''
        });

      expect(response.status).toBe(400);
    });

    it('should allow partial update', async () => {
      if (!pageId) return;

      const response = await request(app)
        .put(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Partially Updated Title'
        });

      expect(response.status).toBe(200);
    });

    it('should reject invalid page ID', async () => {
      const response = await request(app)
        .put('/api/pages/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Title'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/pages/course/:courseId', () => {
    it('should get pages by course', async () => {
      const response = await request(app)
        .get(`/api/pages/course/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject invalid course ID', async () => {
      const response = await request(app)
        .get('/api/pages/course/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/pages/:id', () => {
    it('should delete page (teacher)', async () => {
      // Create a page to delete
      const createResponse = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Page to Delete',
          module: moduleId,
          content: 'Content to delete'
        });
      const deletePageId = createResponse.body.data._id || createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/pages/${deletePageId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should prevent student from deleting page', async () => {
      if (!pageId) return;

      const response = await request(app)
        .delete(`/api/pages/${pageId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject invalid page ID', async () => {
      const response = await request(app)
        .delete('/api/pages/invalid-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent page', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/pages/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });
});

