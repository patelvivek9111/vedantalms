// Jest setup file for test configuration
// This file runs before each test suite

const fs = require('fs');
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt';
// Quiet pino / pino-http when tests load server.js (avoids JSON noise on stdout).
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

const useAtlas =
  process.env.JEST_USE_ATLAS_MONGO === '1' ||
  process.env.JEST_USE_ATLAS_MONGO === 'true';

const memoryUriFile = path.join(__dirname, '.mongo-memory-uri');
if (!useAtlas && fs.existsSync(memoryUriFile)) {
  process.env.MONGODB_URI = fs.readFileSync(memoryUriFile, 'utf8').trim();
} else {
  process.env.MONGODB_URI =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';
}

// Increase timeout for async operations
jest.setTimeout(120000);

const mongoose = require('mongoose');

// Fail fast when disconnected instead of buffering until Jest hook timeout.
mongoose.set('bufferCommands', false);

// Close MongoDB pool after each file so Jest workers exit cleanly (mongoose reconnects on next query).
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
