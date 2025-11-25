// Test setup file
// This runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRE = '30d';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';

// Increase timeout for database operations
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Close any open connections
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

