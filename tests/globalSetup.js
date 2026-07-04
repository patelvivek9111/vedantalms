'use strict';

const fs = require('fs');
const path = require('path');
const { createMongoMemoryServer } = require('./mongoMemoryServer');
const { createJestArtifactsRoot, removeJestArtifactsRoot } = require('./exportPaths');

const URI_FILE = path.join(__dirname, '.mongo-memory-uri');

/**
 * Start a shared in-memory MongoDB for Jest workers.
 * Returns a teardown fn so the server stops after the full run.
 * Set JEST_USE_ATLAS_MONGO=1 to keep using MONGODB_URI from the environment instead.
 */
module.exports = async () => {
  const useAtlas =
    process.env.JEST_USE_ATLAS_MONGO === '1' ||
    process.env.JEST_USE_ATLAS_MONGO === 'true';

  if (!useAtlas) {
    const mongoServer = await createMongoMemoryServer();
    const uri = mongoServer.getUri();
    fs.writeFileSync(URI_FILE, uri, 'utf8');

    createJestArtifactsRoot();

    return async () => {
      await mongoServer.stop().catch(() => {});
      try {
        fs.unlinkSync(URI_FILE);
      } catch (_) {
        /* already removed */
      }
      removeJestArtifactsRoot();
    };
  }

  createJestArtifactsRoot();
  return async () => {
    removeJestArtifactsRoot();
  };
};
