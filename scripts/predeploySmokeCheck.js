const mongoose = require('mongoose');
const Redis = require('ioredis');
const dotenv = require('dotenv');
const { ensureCriticalIndexes } = require('../utils/ensureIndexes');

dotenv.config();

const STATUS = {
  SKIPPED: 'skipped',
  WARNING: 'warning',
  FAILURE: 'failure',
  SUCCESS: 'success',
};

function logStatus(status, message) {
  console.log(`[smoke] status=${status} ${message}`);
}

function logWarning(message) {
  logStatus(STATUS.WARNING, message);
}

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logStatus(
      STATUS.SKIPPED,
      'MONGODB_URI not set — skipping predeploy smoke (configure repo secrets for full check)'
    );
    process.exit(0);
  }

  const mongoOptions = {
    dbName: process.env.MONGO_DB_NAME || 'lms',
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10),
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '2', 10),
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
    socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || '45000', 10),
  };

  let warnings = 0;

  console.log('[smoke] Connecting to MongoDB...');
  try {
    await mongoose.connect(mongoUri, mongoOptions);
    console.log('[smoke] MongoDB connection: OK');
  } catch (error) {
    logStatus(STATUS.FAILURE, `MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }

  const previousSync = process.env.SYNC_INDEXES_ON_BOOT;
  process.env.SYNC_INDEXES_ON_BOOT = 'true';
  try {
    await ensureCriticalIndexes(console);
    console.log('[smoke] Critical index sync: OK');
  } catch (error) {
    logStatus(STATUS.FAILURE, `Critical index sync failed: ${error.message}`);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }
    process.exit(1);
  } finally {
    process.env.SYNC_INDEXES_ON_BOOT = previousSync;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (process.env.REQUIRE_REDIS === 'true') {
      logStatus(STATUS.FAILURE, 'REDIS_URL is required when REQUIRE_REDIS=true');
      try {
        await mongoose.connection.close();
      } catch {
        // ignore
      }
      process.exit(1);
    }
    logStatus(STATUS.SKIPPED, 'Redis check skipped (REDIS_URL not set)');
  } else {
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: () => null,
    });
    redis.on('error', () => {
      // Handled in connect/ping catch — avoids unhandled error events when Redis is down.
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${pong}`);
      }
      console.log('[smoke] Redis ping: OK');
    } catch (error) {
      if (process.env.REQUIRE_REDIS === 'true') {
        logStatus(STATUS.FAILURE, `Redis check failed: ${error.message}`);
        try {
          await mongoose.connection.close();
        } catch {
          // ignore
        }
        process.exit(1);
      }
      warnings += 1;
      logWarning(`Redis check failed (non-blocking): ${error.message}`);
    } finally {
      try {
        redis.disconnect();
      } catch {
        // ignore
      }
    }
  }

  if (!process.env.JWT_SECRET) {
    warnings += 1;
    logWarning('JWT_SECRET not set — auth-dependent deploy checks may be incomplete');
  }

  await mongoose.connection.close();

  if (warnings > 0) {
    logStatus(
      STATUS.WARNING,
      `Predeploy smoke completed with ${warnings} warning(s); core Mongo checks passed`
    );
    process.exit(0);
  }

  logStatus(STATUS.SUCCESS, 'Predeploy smoke check passed');
};

run().catch(async (error) => {
  logStatus(STATUS.FAILURE, error.message);
  try {
    await mongoose.connection.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
