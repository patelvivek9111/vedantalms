const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../server');
const User = require('../../../models/user.model');
const Course = require('../../../models/course.model');
const { createMongoMemoryServer } = require('../../mongoMemoryServer');

const unique = Date.now();
const MONGO_OPTS = {
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 15_000,
  bufferCommands: false,
};

let mongoServer;

async function ensureMongoReady() {
  const deadline = Date.now() + 90_000;
  while (mongoose.connection.readyState !== 1 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not ready for route gap API tests');
  }
  mongoose.set('bufferCommands', false);
}

describe('§15 API route gaps — smoke coverage', () => {
  let teacherToken;
  let adminToken;
  let courseId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    mongoServer = await createMongoMemoryServer();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';

    await mongoose.connect(mongoServer.getUri(), MONGO_OPTS);
    await ensureMongoReady();

    const teacherRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Route',
        lastName: 'Teacher',
        email: `route-gaps-teacher-${unique}@test.com`,
        password: 'password123',
        role: 'teacher',
      });
    teacherToken = teacherRes.body.token;

    const adminUser = await User.create({
      firstName: 'Route',
      lastName: 'Admin',
      email: `route-gaps-admin-${unique}@test.com`,
      password: 'password123',
      role: 'admin',
    });
    adminToken = adminUser.getSignedJwtToken();

    const courseRes = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `Route Gaps Course ${unique}`,
        description: 'API smoke test course for route gaps.',
        code: `RG${String(unique).slice(-4)}`,
        published: true,
      });
    courseId = courseRes.body.data?._id || courseRes.body.data?.id;
  }, 180_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({
        email: {
          $in: [`route-gaps-teacher-${unique}@test.com`, `route-gaps-admin-${unique}@test.com`],
        },
      }).catch(() => {});
      await Course.deleteMany({ title: `Route Gaps Course ${unique}` }).catch(() => {});
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('POST /api/contact/inquiry', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/contact/inquiry').send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBeTruthy();
    });

    it('accepts a valid inquiry payload', async () => {
      const res = await request(app).post('/api/contact/inquiry').send({
        name: 'E2E Contact',
        email: 'contact-test@example.com',
        organization: 'Vidya LMS',
        jobTitle: 'QA',
        userCount: '100-500',
        extra: 'Route gap smoke test',
      });
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.ok).toBe(true);
      }
    });
  });

  describe('QuizWave /api/quizwave', () => {
    it('requires auth for course quiz list', async () => {
      const res = await request(app).get(`/api/quizwave/courses/${courseId}`);
      expect(res.status).toBe(401);
    });

    it('lists quizzes for a course (teacher)', async () => {
      const res = await request(app)
        .get(`/api/quizwave/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('creates a quiz with validation', async () => {
      const res = await request(app)
        .post(`/api/quizwave/courses/${courseId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Route Gap Quiz',
          questions: [
            {
              questionText: '2 + 2 = ?',
              questionType: 'multiple-choice',
              options: [
                { text: '3', isCorrect: false },
                { text: '4', isCorrect: true },
              ],
            },
          ],
        });
      expect(res.status).toBe(201);
      const quizId = res.body.data?._id || res.body._id;
      expect(quizId).toBeTruthy();

      const getRes = await request(app)
        .get(`/api/quizwave/${quizId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(getRes.status).toBe(200);
    });
  });

  describe('GET /api/integrations/zoho-meeting/status', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/integrations/zoho-meeting/status');
      expect(res.status).toBe(401);
    });

    it('returns connection status for teacher', async () => {
      const res = await request(app)
        .get('/api/integrations/zoho-meeting/status')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.connected).toBe('boolean');
    });
  });

  describe('GET /api/registrar/reports/*', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/registrar/reports/term-completion');
      expect(res.status).toBe(401);
    });

    it('returns term-completion report for admin', async () => {
      const res = await request(app)
        .get('/api/registrar/reports/term-completion')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns amendments report for admin', async () => {
      const res = await request(app)
        .get('/api/registrar/reports/amendments')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/ops/*', () => {
    it('requires auth for recovery summary', async () => {
      const res = await request(app).get('/api/ops/recovery');
      expect(res.status).toBe(401);
    });

    it('returns recovery summary for admin', async () => {
      const res = await request(app)
        .get('/api/ops/recovery')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns ops dashboard for admin', async () => {
      const res = await request(app)
        .get('/api/ops/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/login-activity', () => {
    it('returns paginated login activity for authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/login-activity?page=1&limit=5&days=30')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });
  });
});
