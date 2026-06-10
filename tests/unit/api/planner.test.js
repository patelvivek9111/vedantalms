const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../../models/user.model');
const { waitForMongoConnection } = require('../../helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Planner API', () => {
  let token;
  const originalFlag = process.env.PLANNER_UX_ENABLED;

  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
    process.env.PLANNER_UX_ENABLED = 'true';

    await User.deleteMany({ email: 'planner-api@test.com' });
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'Planner',
      lastName: 'User',
      email: 'planner-api@test.com',
      password: 'password123',
      role: 'student',
    });
    token = response.body.token;
  });

  afterAll(async () => {
    process.env.PLANNER_UX_ENABLED = originalFlag;
    await User.deleteMany({ email: 'planner-api@test.com' });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('returns ranked planner feed when enabled', async () => {
    const response = await request(app)
      .get('/api/planner/feed')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta).toBeDefined();
  });

  it('returns 404 when planner ux flag is disabled', async () => {
    process.env.PLANNER_UX_ENABLED = 'false';
    const response = await request(app)
      .get('/api/planner/feed')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    process.env.PLANNER_UX_ENABLED = 'true';
  });
});
