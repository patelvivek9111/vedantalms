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
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '3000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS || '5000', 10),
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  connection.on('error', (err) => {
    console.error('bullmq redis connection error', err?.message || err);
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
