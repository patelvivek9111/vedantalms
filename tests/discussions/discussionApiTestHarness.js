'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { createMongoMemoryServer } = require('../mongoMemoryServer');

const MONGO_CONNECT_OPTS = {
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 15_000,
  /** Fail fast when disconnected instead of buffering until Jest hook timeout. */
  bufferCommands: false,
};

async function disconnectMongooseIfConnected() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Spin up in-memory Mongo for discussion HTTP API tests.
 * @returns {Promise<{ mongoServer: import('mongodb-memory-server').MongoMemoryServer }>}
 */
async function startDiscussionApiMongo() {
  await disconnectMongooseIfConnected();
  const mongoServer = await createMongoMemoryServer();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';
  await mongoose.connect(uri, MONGO_CONNECT_OPTS);
  await mongoose.connection.dropDatabase();
  return { mongoServer };
}

/**
 * @param {import('mongodb-memory-server').MongoMemoryServer | undefined} mongoServer
 * @param {{ threadId?: import('mongoose').Types.ObjectId | string }} [opts]
 */
async function stopDiscussionApiMongo(mongoServer, opts = {}) {
  const { threadId } = opts;
  if (mongoose.connection.readyState === 1) {
    if (threadId) {
      const DiscussionReply = require('../../models/discussionReply.model');
      await DiscussionReply.deleteMany({ threadId }).catch(() => {});
    }
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Minimal Express app for thread/reply route tests.
 * @param {{ includeReplyRoutes?: boolean }} [opts]
 */
function createDiscussionApp(opts = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/threads', require('../../routes/thread.routes'));
  if (opts.includeReplyRoutes) {
    app.use('/api/replies', require('../../routes/reply.routes'));
  }
  return app;
}

module.exports = {
  startDiscussionApiMongo,
  stopDiscussionApiMongo,
  createDiscussionApp,
};
