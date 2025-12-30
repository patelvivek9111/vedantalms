const request = require('supertest');
const app = require('../server');

describe('Health Check API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.environment).toBeDefined();
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
    });
  });
});

























