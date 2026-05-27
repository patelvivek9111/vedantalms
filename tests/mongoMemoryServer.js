'use strict';

/**
 * Shared in-memory Mongo for Jest. Default launchTimeout is 10s which is too low on slow/Windows CI.
 * @see https://github.com/typegoose/mongodb-memory-server#options-which-can-be-set-via-environment-variables
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

const LAUNCH_TIMEOUT_MS = Number(process.env.MONGO_MEMORY_LAUNCH_TIMEOUT_MS || 120000);

/**
 * @param {object} [overrides] - forwarded to MongoMemoryServer.create (e.g. binary, instance args).
 */
async function createMongoMemoryServer(overrides = {}) {
  const { instance: instanceOverrides, ...rest } = overrides;
  return MongoMemoryServer.create({
    instance: {
      launchTimeout: LAUNCH_TIMEOUT_MS,
      ...(instanceOverrides || {}),
    },
    ...rest,
  });
}

module.exports = { createMongoMemoryServer };
