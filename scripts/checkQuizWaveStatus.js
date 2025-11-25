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
    const totalSessionsCount = typeof totalSessions === 'number' ? totalSessions : 0;
    console.log(`Total sessions: ${totalSessionsCount}`);
    
    // Sessions by status
    const waiting = await QuizSession.countDocuments({ status: 'waiting' });
    const active = await QuizSession.countDocuments({ status: 'active' });
    const paused = await QuizSession.countDocuments({ status: 'paused' });
    const ended = await QuizSession.countDocuments({ status: 'ended' });
    
    console.log(`  - Waiting: ${typeof waiting === 'number' ? waiting : 0}`);
    console.log(`  - Active: ${typeof active === 'number' ? active : 0}`);
    console.log(`  - Paused: ${typeof paused === 'number' ? paused : 0}`);
    console.log(`  - Ended: ${typeof ended === 'number' ? ended : 0}`);
    
    // Old ended sessions (2+ days)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    if (isNaN(twoDaysAgo.getTime())) {
      throw new Error('Invalid date calculation');
    }

    const oldEnded = await QuizSession.countDocuments({
      status: 'ended',
      createdAt: { $lt: twoDaysAgo }
    });
    const oldEndedCount = typeof oldEnded === 'number' ? oldEnded : 0;
    console.log(`\nOld ended sessions (2+ days): ${oldEndedCount}`);
    
    // Check for duplicate PINs
    const sessions = await QuizSession.find({}).select('gamePin').lean();
    if (!Array.isArray(sessions)) {
      throw new Error('Invalid sessions array returned from database');
    }

    const pinCounts = {};
    sessions.forEach(s => {
      if (s && s.gamePin && typeof s.gamePin === 'string') {
        pinCounts[s.gamePin] = (pinCounts[s.gamePin] || 0) + 1;
      }
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
    if (possiblePins > 0 && totalSessionsCount > 0) {
      const collisionProb = ((totalSessionsCount / possiblePins) * 100).toFixed(2);
      if (isFinite(parseFloat(collisionProb))) {
        console.log(`\nPIN collision probability: ${collisionProb}%`);
      } else {
        console.log('\nPIN collision probability: Unable to calculate');
      }
    } else {
      console.log('\nPIN collision probability: 0%');
    }
    
    if (totalSessionsCount > 800000) {
      console.log('⚠️  WARNING: Very high collision probability! Consider cleaning up old sessions.');
    }
    
    // Offer to clean up
    if (oldEndedCount > 0) {
      console.log(`\n🧹 Would you like to clean up ${oldEndedCount} old ended sessions? (This will free up PINs)`);
      console.log('Run: node scripts/cleanupOldSessions.js');
    }
    
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking status:', error);
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close();
    }
    process.exit(1);
  }
}

