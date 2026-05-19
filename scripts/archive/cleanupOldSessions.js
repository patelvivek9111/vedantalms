const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { cleanupOldSessions } = require('../utils/quizwaveCleanup');

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    console.log('🧹 Starting cleanup...\n');
    const result = await cleanupOldSessions();
    console.log('\n✅ Cleanup completed!');
    console.log(`Deleted ${result.deletedSessions} sessions and ${result.deletedResponses} responses`);
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

