const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../../server');
const User = require('../../../models/user.model');
const { waitForMongoConnection } = require('../../helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Security hardening API', () => {
  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'sec-student@test.com',
          'sec-suspended@test.com',
          'sec-escalate@test.com',
        ],
      },
    });
  });

  it('rejects admin role on public registration in production mode', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Bad',
        lastName: 'Actor',
        email: 'sec-escalate@test.com',
        password: 'password1A',
        role: 'admin',
        termsAccepted: true,
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      const user = await User.findOne({ email: 'sec-escalate@test.com' });
      if (user) {
        expect(user.role).toBe('student');
      }
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('requires terms acceptance on registration in production', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'No',
        lastName: 'Terms',
        email: 'sec-student@test.com',
        password: 'password1A',
      });
      expect(res.status).toBe(400);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('rejects weak passwords', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Weak',
      lastName: 'Pass',
      email: 'sec-student@test.com',
      password: 'short',
      termsAccepted: true,
    });
    expect(res.status).toBe(400);
  });

  it('blocks suspended users with valid JWT after token version bump', async () => {
    const user = await User.create({
      firstName: 'Suspended',
      lastName: 'User',
      email: 'sec-suspended@test.com',
      password: 'password1A',
      role: 'student',
      accountStatus: 'active',
    });
    const token = user.getSignedJwtToken();

    user.accountStatus = 'suspended';
    await user.invalidateSessions();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('invalidates JWT when tokenVersion changes', async () => {
    const user = await User.create({
      firstName: 'Version',
      lastName: 'Test',
      email: 'sec-student@test.com',
      password: 'password1A',
      role: 'student',
    });
    const token = user.getSignedJwtToken();
    await user.invalidateSessions();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('sets httpOnly auth cookie on login', async () => {
    await User.create({
      firstName: 'Cookie',
      lastName: 'Test',
      email: 'sec-student@test.com',
      password: 'password1A',
      role: 'student',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'sec-student@test.com',
      password: 'password1A',
    });

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('lms_auth='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
  });
});
