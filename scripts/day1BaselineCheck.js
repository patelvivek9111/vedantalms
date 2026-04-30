const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Redis = require('ioredis');

dotenv.config();

const parseUrls = () => {
  const raw = process.env.APP_HEALTH_URLS || '';
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => u.endsWith('/health/ready') ? u : `${u.replace(/\/$/, '')}/health/ready`);
};

const checkAppHealth = async (urls) => {
  if (urls.length === 0) {
    console.log('[day1] APP_HEALTH_URLS not set; skipping app-node readiness checks');
    return { okCount: 0, total: 0, responses: [] };
  }

  const responses = [];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const body = await res.json();
      responses.push({ url, status: res.status, body });
    } catch (error) {
      responses.push({ url, status: 0, body: { error: error.message } });
    }
  }

  const okCount = responses.filter((r) => r.status === 200 && r.body?.status === 'ready').length;
  return { okCount, total: responses.length, responses };
};

const checkMongo = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || 'lms',
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '5000', 10)
  });

  const admin = mongoose.connection.db.admin();
  const hello = await admin.command({ hello: 1 });
  const replSet = hello.setName || null;
  await mongoose.connection.close();
  return { connected: true, replSet };
};

const checkRedis = async () => {
  if (!process.env.REDIS_URL) {
    if (process.env.REQUIRE_REDIS === 'true') {
      throw new Error('REQUIRE_REDIS=true but REDIS_URL is not set');
    }
    return { skipped: true };
  }

  const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null });
  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error(`Unexpected ping response: ${pong}`);
    return { skipped: false };
  } finally {
    redis.disconnect();
  }
};

const main = async () => {
  const requireMulti = process.env.REQUIRE_MULTI_INSTANCE === 'true';
  const urls = parseUrls();

  const [appHealth, mongoStatus, redisStatus] = await Promise.all([
    checkAppHealth(urls),
    checkMongo(),
    checkRedis()
  ]);

  if (requireMulti) {
    if (appHealth.total < 3) {
      throw new Error(`REQUIRE_MULTI_INSTANCE=true but only ${appHealth.total} app health URL(s) configured`);
    }
    if (appHealth.okCount < 3) {
      throw new Error(`Multi-instance check failed: ${appHealth.okCount}/${appHealth.total} app nodes ready`);
    }
  }

  if (process.env.REQUIRE_MANAGED_MONGO === 'true' && !mongoStatus.replSet) {
    throw new Error('Mongo replication check failed: no replica set detected');
  }

  console.log('[day1] app health:', appHealth);
  console.log('[day1] mongo status:', mongoStatus);
  console.log('[day1] redis status:', redisStatus);
  console.log('[day1] Day 1 baseline check passed');
};

main().catch((error) => {
  console.error('[day1] Day 1 baseline check failed:', error.message);
  process.exit(1);
});
