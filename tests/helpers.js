const mongoose = require('mongoose');

const MONGO_CONNECT_OPTS = {
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 15_000,
  bufferCommands: false,
};

/**
 * Wait for MongoDB connection to be established.
 * Works with the shared in-memory server from tests/globalSetup.js or any explicit URI.
 * @param {string} [uri] - MongoDB connection URI (defaults to process.env.MONGODB_URI)
 */
const waitForMongoConnection = async (uri = process.env.MONGODB_URI) => {
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  mongoose.set('bufferCommands', false);

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('MongoDB connection timed out while connecting')),
        20_000
      );
      mongoose.connection.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      mongoose.connection.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    if (mongoose.connection.readyState === 1) {
      return;
    }
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri, MONGO_CONNECT_OPTS);

  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection not ready after connect');
  }
};

module.exports = {
  waitForMongoConnection,
};
