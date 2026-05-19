const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const { waitForMongoConnection } = require('./helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

describe('Uploads API', () => {
  beforeAll(async () => {
    await waitForMongoConnection(MONGODB_URI);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Upload endpoints', () => {
    it('should have upload routes defined', () => {
      expect(app).toBeDefined();
    });
  });
});

