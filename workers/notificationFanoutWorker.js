const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { startNotificationFanoutWorker } = require('../services/notificationFanoutQueue.service');

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  if (!process.env.REDIS_URL) {
    console.error('REDIS_URL is required for notification fanout worker');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || 'lms',
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10),
  });

  const worker = startNotificationFanoutWorker();
  if (!worker) {
    console.error('Failed to start notification fanout worker (check REDIS_URL)');
    process.exit(1);
  }

  console.log('Notification fanout worker started (queue: notifications)');

  const shutdown = async () => {
    await worker.close();
    await mongoose.connection.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('notification fanout worker failed', err);
  process.exit(1);
});
