const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { QuizSession } = require('../models/quizwave.model');
const { cleanupOldSessions } = require('../utils/quizwaveCleanup');

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    checkStatus();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

async function checkStatus() {
  try {
    console.log('\n📊 QuizWave Database Status:\n');
    
    // Total sessions
    const totalSessions = await QuizSession.countDocuments({});
    console.log(`Total sessions: ${totalSessions}`);
    
    // Sessions by status
    const waiting = await QuizSession.countDocuments({ status: 'waiting' });
    const active = await QuizSession.countDocuments({ status: 'active' });
    const paused = await QuizSession.countDocuments({ status: 'paused' });
    const ended = await QuizSession.countDocuments({ status: 'ended' });
    
    console.log(`  - Waiting: ${waiting}`);
    console.log(`  - Active: ${active}`);
    console.log(`  - Paused: ${paused}`);
    console.log(`  - Ended: ${ended}`);
    
    // Old ended sessions (2+ days)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const oldEnded = await QuizSession.countDocuments({
      status: 'ended',
      createdAt: { $lt: twoDaysAgo }
    });
    console.log(`\nOld ended sessions (2+ days): ${oldEnded}`);
    
    // Check for duplicate PINs
    const sessions = await QuizSession.find({}).select('gamePin').lean();
    const pinCounts = {};
    sessions.forEach(s => {
      pinCounts[s.gamePin] = (pinCounts[s.gamePin] || 0) + 1;
    });
    const duplicates = Object.entries(pinCounts).filter(([pin, count]) => count > 1);
    
    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} duplicate PIN(s)!`);
      duplicates.forEach(([pin, count]) => {
        console.log(`  - PIN ${pin}: ${count} sessions`);
      });
    } else {
      console.log('\n✅ No duplicate PINs found');
    }
    
    // PIN collision probability
    const possiblePins = 900000; // 100000-999999
    const collisionProb = ((totalSessions / possiblePins) * 100).toFixed(2);
    console.log(`\nPIN collision probability: ${collisionProb}%`);
    
    if (totalSessions > 800000) {
      console.log('⚠️  WARNING: Very high collision probability! Consider cleaning up old sessions.');
    }
    
    // Offer to clean up
    if (oldEnded > 0) {
      console.log(`\n🧹 Would you like to clean up ${oldEnded} old ended sessions? (This will free up PINs)`);
      console.log('Run: node scripts/cleanupOldSessions.js');
    }
    
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking status:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

