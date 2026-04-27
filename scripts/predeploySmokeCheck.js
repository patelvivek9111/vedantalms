const mongoose = require('mongoose');
const Redis = require('ioredis');
const dotenv = require('dotenv');
const { ensureCriticalIndexes } = require('../utils/ensureIndexes');

dotenv.config();

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required for smoke check');
  }

  const mongoOptions = {
    dbName: process.env.MONGO_DB_NAME || 'lms',
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10),
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '2', 10),
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
    socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || '45000', 10),
  };

  console.log('[smoke] Connecting to MongoDB...');
  await mongoose.connect(mongoUri, mongoOptions);
  console.log('[smoke] MongoDB connection: OK');

  const previousSync = process.env.SYNC_INDEXES_ON_BOOT;
  process.env.SYNC_INDEXES_ON_BOOT = 'true';
  await ensureCriticalIndexes(console);
  process.env.SYNC_INDEXES_ON_BOOT = previousSync;
  console.log('[smoke] Critical index sync: OK');

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (process.env.REQUIRE_REDIS === 'true') {
      throw new Error('REDIS_URL is required when REQUIRE_REDIS=true');
    }
    console.log('[smoke] Redis skipped (REDIS_URL not set)');
  } else {
    const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
    try {
      await redis.connect();
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${pong}`);
      }
      console.log('[smoke] Redis ping: OK');
    } finally {
      redis.disconnect();
    }
  }

  await mongoose.connection.close();
  console.log('[smoke] Predeploy smoke check passed');
};

run().catch(async (error) => {
  console.error('[smoke] Predeploy smoke check failed:', error.message);
  try {
    await mongoose.connection.close();
  } catch (closeError) {
    // ignore close error
  }
  process.exit(1);
});
