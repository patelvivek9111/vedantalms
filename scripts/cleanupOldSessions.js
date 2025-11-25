const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { cleanupOldSessions } = require('../utils/quizwaveCleanup');

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    try {
      console.log('✅ Connected to MongoDB');
      console.log('🧹 Starting cleanup...\n');
      
      const result = await cleanupOldSessions();
      
      // Validate result
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid result from cleanup function');
      }

      const deletedSessions = typeof result.deletedSessions === 'number' ? result.deletedSessions : 0;
      const deletedResponses = typeof result.deletedResponses === 'number' ? result.deletedResponses : 0;

      console.log('\n✅ Cleanup completed!');
      console.log(`Deleted ${deletedSessions} sessions and ${deletedResponses} responses`);
      
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
      }
      process.exit(0);
    } catch (cleanupError) {
      console.error('❌ Cleanup error:', cleanupError);
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
      }
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

