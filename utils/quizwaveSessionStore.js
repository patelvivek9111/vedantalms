const Redis = require('ioredis');

const localSessions = new Map();
const REDIS_PREFIX = 'quizwave:session:';

let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    commandTimeout: 1000,
    enableOfflineQueue: false,
    retryStrategy: () => null
  });
  redisClient.on('error', () => {
    redisClient = null;
  });
  redisClient.connect().catch(() => {
    redisClient = null;
  });
}

const buildKey = (gamePin) => `${REDIS_PREFIX}${gamePin}`;

const setSession = async (gamePin, value) => {
  if (redisClient) {
    try {
      await redisClient.set(buildKey(gamePin), JSON.stringify(value), 'EX', 24 * 60 * 60);
      return;
    } catch {
      redisClient = null;
    }
  }
  localSessions.set(gamePin, value);
};

const getSession = async (gamePin) => {
  if (redisClient) {
    try {
      const raw = await redisClient.get(buildKey(gamePin));
      return raw ? JSON.parse(raw) : null;
    } catch {
      redisClient = null;
    }
  }
  return localSessions.get(gamePin) || null;
};

const deleteSession = async (gamePin) => {
  if (redisClient) {
    try {
      await redisClient.del(buildKey(gamePin));
      return;
    } catch {
      redisClient = null;
    }
  }
  localSessions.delete(gamePin);
};

module.exports = {
  setSession,
  getSession,
  deleteSession
};
