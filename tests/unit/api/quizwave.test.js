const request = require('supertest');
const app = require('../../../server');

describe('QuizWave API', () => {
  describe('QuizWave endpoints', () => {
    it('requires auth for course quiz routes', async () => {
      const res = await request(app).get('/api/quizwave/courses/507f1f77bcf86cd799439011');
      expect(res.status).toBe(401);
    });

    it('create/list flows are covered in routeGaps.api.test.js', () => {
      expect(app).toBeDefined();
    });
  });
});
