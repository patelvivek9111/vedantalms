const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Assignment = require('../models/Assignment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Assignment API', () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let courseId;
  let moduleId;
  let assignmentId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    
    // Clean up test data
    await User.deleteMany({ email: { $in: ['teacher-assign@test.com', 'student-assign@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Assignments' });
    await Assignment.deleteMany({ title: 'Test Assignment' });

    // Create teacher
    const teacherResponse = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Teacher',
        lastName: 'Assign',
        email: 'teacher-assign@test.com',
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
        lastName: 'Assign',
        email: 'student-assign@test.com',
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
        title: 'Test Course for Assignments',
        description: 'Course for testing assignments',
        code: 'TEST101'
      });
    courseId = courseResponse.body.data._id || courseResponse.body.data.id;

    // Create module
    const moduleResponse = await request(app)
      .post('/api/modules')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Module',
        course: courseId,
        description: 'Test module for assignments'
      });
    
    expect(moduleResponse.status).toBe(201);
    moduleId = moduleResponse.body.data?._id || moduleResponse.body.data?.id || moduleResponse.body._id || moduleResponse.body.id;
    
    if (!moduleId) {
      throw new Error('Failed to create module for tests');
    }
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teacher-assign@test.com', 'student-assign@test.com'] } });
    await Course.deleteMany({ title: 'Test Course for Assignments' });
    await Assignment.deleteMany({ title: 'Test Assignment' });
    await Module.deleteMany({ title: 'Test Module' });
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('POST /api/assignments', () => {
    const baseAssignment = {
      title: 'Test Assignment',
      description: 'This is a test assignment',
      moduleId: null, // Will be set in tests
      availableFrom: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
      questions: JSON.stringify([])
    };

    it('should create assignment with valid data', async () => {
      const assignmentData = {
        ...baseAssignment,
        moduleId: moduleId
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(assignmentData);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Test Assignment');
      expect(response.body.description).toBe('This is a test assignment');
      expect(response.body.createdBy.toString()).toBe(teacherId);
      assignmentId = response.body._id;
    });

    it('should reject assignment creation with missing title', async () => {
      const assignmentData = {
        ...baseAssignment,
        title: '',
        moduleId: moduleId
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(assignmentData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Title is required');
    });

    it('should reject assignment creation with missing description', async () => {
      const assignmentData = {
        ...baseAssignment,
        description: '',
        moduleId: moduleId
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(assignmentData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Description is required');
    });

    it('should reject assignment creation with missing dates', async () => {
      const assignmentData = {
        ...baseAssignment,
        availableFrom: '',
        moduleId: moduleId
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(assignmentData);

      expect(response.status).toBe(400);
    });

    it('should reject assignment creation when dueDate is before availableFrom', async () => {
      const assignmentData = {
        ...baseAssignment,
        moduleId: moduleId,
        availableFrom: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(assignmentData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Due date must be after available from date');
    });

    it('should create assignment with questions', async () => {
      const questions = [
        {
          id: '1',
          type: 'text',
          text: 'What is 2+2?',
          points: 10
        },
        {
          id: '2',
          type: 'multiple-choice',
          text: 'Choose the correct answer',
          points: 20,
          options: [
            { text: 'Option 1', isCorrect: false },
            { text: 'Option 2', isCorrect: true }
          ]
        }
      ];

      const assignmentData = {
        ...baseAssignment,
        moduleId: moduleId,
        title: 'Test Assignment with Questions',
        questions: JSON.stringify(questions)
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(assignmentData);

      expect(response.status).toBe(201);
      expect(response.body.questions).toBeDefined();
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBe(2);
    });

    it('should reject assignment creation with invalid questions JSON', async () => {
      const assignmentData = {
        ...baseAssignment,
        moduleId: moduleId,
        questions: 'invalid json'
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(assignmentData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid questions format');
    });

    it('should prevent student from creating assignment', async () => {
      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(baseAssignment);

      expect(response.status).toBe(403);
    });

    it('should create group assignment', async () => {
      const assignmentData = {
        ...baseAssignment,
        title: 'Test Group Assignment',
        isGroupAssignment: true,
        groupSet: new mongoose.Types.ObjectId().toString()
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(assignmentData);

      expect(response.status).toBe(201);
      expect(response.body.isGroupAssignment).toBe(true);
    });
  });

  describe('GET /api/assignments/:id', () => {
    it('should get assignment by ID', async () => {
      if (!assignmentId) {
        // Create assignment if not exists
        const createResponse = await request(app)
          .post('/api/assignments')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Test Assignment for Get',
            description: 'Test description',
            moduleId: moduleId,
            availableFrom: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            questions: JSON.stringify([])
          });
        assignmentId = createResponse.body._id;
      }

      const response = await request(app)
        .get(`/api/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body._id.toString()).toBe(assignmentId.toString());
      expect(response.body.title).toBeDefined();
    });

    it('should return 404 for non-existent assignment', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/assignments/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should allow student to view published assignment', async () => {
      if (!assignmentId) return;
      
      // First publish the assignment
      await request(app)
        .patch(`/api/assignments/${assignmentId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const response = await request(app)
        .get(`/api/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/assignments/module/:moduleId', () => {
    it('should get assignments for a module', async () => {
      const response = await request(app)
        .get(`/api/assignments/module/${moduleId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should only show published assignments to students', async () => {
      const response = await request(app)
        .get(`/api/assignments/module/${moduleId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // All returned assignments should be published
      response.body.forEach(assignment => {
        expect(assignment.published).toBe(true);
      });
    });
  });

  describe('PUT /api/assignments/:id', () => {
    let updateAssignmentId;

    beforeAll(async () => {
      // Create assignment for update tests
      const createResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Assignment to Update',
          description: 'Original description',
          moduleId: moduleId,
          availableFrom: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          questions: JSON.stringify([])
        });
      updateAssignmentId = createResponse.body._id;
    });

    it('should update assignment', async () => {
      const response = await request(app)
        .put(`/api/assignments/${updateAssignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Updated Assignment Title',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      // Update returns { success: true, data: assignment }
      const assignment = response.body.data || response.body;
      expect(assignment).toBeDefined();
      expect(assignment.title).toBe('Updated Assignment Title');
      expect(assignment.description).toBe('Updated description');
    });

    it('should validate dates when updating', async () => {
      const response = await request(app)
        .put(`/api/assignments/${updateAssignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          availableFrom: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Due date must be after available from date');
    });

    it('should prevent student from updating assignment', async () => {
      const response = await request(app)
        .put(`/api/assignments/${updateAssignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student trying to update'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/assignments/:id/publish', () => {
    let publishAssignmentId;

    beforeAll(async () => {
      const createResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Assignment to Publish',
          description: 'Test description',
          moduleId: moduleId,
          availableFrom: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          questions: JSON.stringify([])
        });
      publishAssignmentId = createResponse.body._id;
    });

    it('should publish assignment', async () => {
      const response = await request(app)
        .patch(`/api/assignments/${publishAssignmentId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.published).toBe(true);
    });

    it('should unpublish assignment', async () => {
      const response = await request(app)
        .patch(`/api/assignments/${publishAssignmentId}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.published).toBe(false);
    });

    it('should prevent student from publishing assignment', async () => {
      const response = await request(app)
        .patch(`/api/assignments/${publishAssignmentId}/publish`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/assignments/:id', () => {
    let deleteAssignmentId;

    beforeEach(async () => {
      // Create assignment for deletion
      const createResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Assignment to Delete',
          description: 'Will be deleted',
          moduleId: moduleId,
          availableFrom: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          questions: JSON.stringify([])
        });
      deleteAssignmentId = createResponse.body._id;
    });

    it('should delete assignment', async () => {
      const response = await request(app)
        .delete(`/api/assignments/${deleteAssignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Verify assignment is deleted
      const getResponse = await request(app)
        .get(`/api/assignments/${deleteAssignmentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(getResponse.status).toBe(404);
    });

    it('should prevent student from deleting assignment', async () => {
      const response = await request(app)
        .delete(`/api/assignments/${deleteAssignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 when deleting non-existent assignment', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/assignments/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/assignments/todo/ungraded', () => {
    it('should get ungraded assignments for teacher', async () => {
      const response = await request(app)
        .get('/api/assignments/todo/ungraded')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/assignments/todo/ungraded');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/assignments/todo/due', () => {
    it('should get assignments due this week for student', async () => {
      const response = await request(app)
        .get('/api/assignments/todo/due')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

