const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../../models/user.model');
const { waitForMongoConnection } = require('../../helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('POST /api/notifications/test-create gate', () => {
  let token;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnable = process.env.ENABLE_NOTIFICATION_TEST_CREATE;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    await User.deleteMany({ email: 'notif-gate@test.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Notif',
        lastName: 'Gate',
        email: 'notif-gate@test.com',
        password: 'password123',
        role: 'student',
      });
    token = res.body.token;
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENABLE_NOTIFICATION_TEST_CREATE = originalEnable;
    await User.deleteMany({ email: 'notif-gate@test.com' });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('returns 404 in production when flag is not set', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_NOTIFICATION_TEST_CREATE;

    const res = await request(app)
      .post('/api/notifications/test-create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x', message: 'y' });

    expect(res.status).toBe(404);
  });

  it('allows test-create in production when ENABLE_NOTIFICATION_TEST_CREATE=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_NOTIFICATION_TEST_CREATE = 'true';

    const res = await request(app)
      .post('/api/notifications/test-create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test', message: 'Hello' });

    expect([200, 201, 400]).toContain(res.status);
  });
});
