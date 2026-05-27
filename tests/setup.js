// Jest setup file for test configuration
// This file runs before each test suite

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';
// Quiet pino / pino-http when tests load server.js (avoids JSON noise on stdout).
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

// Increase timeout for async operations
jest.setTimeout(120000);

const mongoose = require('mongoose');

// Close MongoDB pool after each file so parallel Jest workers exit cleanly (mongoose reconnects on next query).
afterAll(async () => {
  await mongoose.disconnect().catch(() => {});
});

// Mute expected middleware / negative-path console noise during tests.
const noop = () => {};
if (!process.env.JEST_VERBOSE_LOGS) {
  Object.assign(console, {
    log: noop,
    info: noop,
    debug: noop,
    trace: noop,
    warn: noop,
    error: noop,
  });
}
