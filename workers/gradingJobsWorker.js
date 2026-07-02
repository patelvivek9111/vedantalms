const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { startGradingWorker } = require('../services/jobQueue.service');

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

async function main() {
  if (!process.env.REDIS_URL) {
    console.error('REDIS_URL is required for grading jobs worker');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, {
    dbName: 'lms',
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10),
  });

  const worker = startGradingWorker();
  if (!worker) {
    console.error('Failed to start grading worker (check REDIS_URL)');
    process.exit(1);
  }

  console.log('Grading jobs worker started (queue: grading)');

  const heartbeat = () => {
    process.env.GRADING_WORKER_HEARTBEAT_AT = new Date().toISOString();
  };
  heartbeat();
  setInterval(heartbeat, 30000).unref();

  const shutdown = async () => {
    await worker.close();
    await mongoose.connection.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('grading jobs worker failed', err);
  process.exit(1);
});
