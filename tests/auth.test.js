const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user.model');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Auth API', () => {
  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    await User.deleteMany({ email: { $in: ['test-auth@test.com'] } });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['test-auth@test.com'] } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'Auth',
          email: 'test-auth@test.com',
          password: 'password123',
          role: 'student'
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('token');
    });
  });
});

