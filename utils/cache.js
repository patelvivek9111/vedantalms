const Redis = require('ioredis');

let redisClient = null;
let redisDisabled = false;

const getRedisClient = () => {
  if (redisDisabled || process.env.NODE_ENV === 'test') return null;
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    commandTimeout: 1000,
    enableOfflineQueue: false,
    retryStrategy: () => null
  });
  redisClient.on('error', () => {
    redisDisabled = true;
    redisClient = null;
  });
  redisClient.connect().catch(() => {
    redisDisabled = true;
    redisClient = null;
  });
  return redisClient;
};

const getJson = async (key) => {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setJson = async (key, value, ttlSeconds = 30) => {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // swallow cache write errors
  }
};

const delJson = async (key) => {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // swallow cache delete errors
  }
};

module.exports = {
  getJson,
  setJson,
  delJson
};
