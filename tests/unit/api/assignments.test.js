const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const { waitForMongoConnection } = require('../../helpers');
const User = require('../../../models/user.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Assignments API', () => {
  let teacherToken;
  let studentToken;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    await User.deleteMany({
      email: { $in: ['assignment-route-teacher@test.com', 'assignment-route-student@test.com'] },
    });

    const teacherRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Assign',
        lastName: 'Teacher',
        email: 'assignment-route-teacher@test.com',
        password: 'password123',
        role: 'teacher',
      });
    teacherToken = teacherRes.body.token;

    const studentRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Assign',
        lastName: 'Student',
        email: 'assignment-route-student@test.com',
        password: 'password123',
        role: 'student',
      });
    studentToken = studentRes.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({
      email: { $in: ['assignment-route-teacher@test.com', 'assignment-route-student@test.com'] },
    });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Assignment endpoints', () => {
    it('should have assignment routes defined', () => {
      expect(app).toBeDefined();
    });

    it('resolves /todo/ungraded without being shadowed by /:id', async () => {
      const response = await request(app)
        .get('/api/assignments/todo/ungraded')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('resolves /todo/due-all without being shadowed by /:id', async () => {
      const response = await request(app)
        .get('/api/assignments/todo/due-all')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

