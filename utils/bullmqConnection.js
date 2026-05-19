const IORedis = require('ioredis');

let connection = null;

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL) && process.env.DISABLE_JOB_QUEUE !== 'true';
}

function getBullmqConnection() {
  if (!isRedisConfigured()) return null;
  if (connection) return connection;
  connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return connection;
}

function closeBullmqConnection() {
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}

module.exports = {
  isRedisConfigured,
  getBullmqConnection,
  closeBullmqConnection,
};
