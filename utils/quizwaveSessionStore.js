const Redis = require('ioredis');

const localSessions = new Map();
const REDIS_PREFIX = 'quizwave:session:';

let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null });
  redisClient.connect().catch(() => {
    redisClient = null;
  });
}

const buildKey = (gamePin) => `${REDIS_PREFIX}${gamePin}`;

const setSession = async (gamePin, value) => {
  if (redisClient) {
    await redisClient.set(buildKey(gamePin), JSON.stringify(value), 'EX', 24 * 60 * 60);
    return;
  }
  localSessions.set(gamePin, value);
};

const getSession = async (gamePin) => {
  if (redisClient) {
    const raw = await redisClient.get(buildKey(gamePin));
    return raw ? JSON.parse(raw) : null;
  }
  return localSessions.get(gamePin) || null;
};

const deleteSession = async (gamePin) => {
  if (redisClient) {
    await redisClient.del(buildKey(gamePin));
    return;
  }
  localSessions.delete(gamePin);
};

module.exports = {
  setSession,
  getSession,
  deleteSession
};
