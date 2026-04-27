const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { cleanupOldSessions } = require('../utils/quizwaveCleanup');

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

const run = async () => {
  await mongoose.connect(mongoUri, {
    dbName: 'lms',
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10)
  });

  await cleanupOldSessions();
  await mongoose.connection.close();
};

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('quizwave cleanup worker failed', err);
    process.exit(1);
  });
