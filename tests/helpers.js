const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_CONNECT_OPTS = {
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 15_000,
  bufferCommands: false,
};

function resolveTestMongoUri(explicitUri) {
  if (explicitUri) return explicitUri;
  const memoryUriFile = path.join(__dirname, '.mongo-memory-uri');
  if (fs.existsSync(memoryUriFile)) {
    const fromFile = fs.readFileSync(memoryUriFile, 'utf8').trim();
    if (fromFile) {
      process.env.MONGODB_URI = fromFile;
      return fromFile;
    }
  }
  return process.env.MONGODB_URI;
}

/**
 * Wait for MongoDB connection to be established.
 * Works with the shared in-memory server from tests/globalSetup.js or any explicit URI.
 * @param {string} [uri] - MongoDB connection URI (defaults to process.env.MONGODB_URI)
 */
const waitForMongoConnection = async (uri) => {
  uri = resolveTestMongoUri(uri);
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

  try {
    await mongoose.connect(uri, MONGO_CONNECT_OPTS);
  } catch (err) {
    const fallback = resolveTestMongoUri();
    if (fallback && fallback !== uri) {
      await mongoose.connect(fallback, MONGO_CONNECT_OPTS);
    } else {
      throw err;
    }
  }

  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection not ready after connect');
  }
};

module.exports = {
  waitForMongoConnection,
};
