const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { QuizSession } = require('../models/quizwave.model');

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    fixDuplicatePins();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

async function fixDuplicatePins() {
  try {
    console.log('🔍 Checking for duplicate PINs...');
    
    // Find all sessions grouped by gamePin
    const sessions = await QuizSession.find({}).lean();
    
    // Group by gamePin
    const pinGroups = {};
    sessions.forEach(session => {
      const pin = session.gamePin;
      if (!pinGroups[pin]) {
        pinGroups[pin] = [];
      }
      pinGroups[pin].push(session);
    });
    
    // Find duplicates
    const duplicates = Object.entries(pinGroups).filter(([pin, sessions]) => sessions.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate PINs found!');
      mongoose.connection.close();
      process.exit(0);
    }
    
    console.log(`⚠️  Found ${duplicates.length} duplicate PIN(s):`);
    
    // Fix duplicates by regenerating PINs for all but the first session
    for (const [pin, duplicateSessions] of duplicates) {
      console.log(`\n📌 PIN ${pin} has ${duplicateSessions.length} sessions:`);
      
      // Sort by creation date - keep the oldest one
      duplicateSessions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Regenerate PINs for all but the first (oldest) session
      for (let i = 1; i < duplicateSessions.length; i++) {
        const session = duplicateSessions[i];
        let newPin;
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 100) {
          attempts++;
          newPin = Math.floor(100000 + Math.random() * 900000).toString();
          const existing = await QuizSession.findOne({ gamePin: newPin });
          if (!existing) {
            isUnique = true;
          }
        }
        
        if (isUnique) {
          await QuizSession.updateOne(
            { _id: session._id },
            { $set: { gamePin: newPin } }
          );
          console.log(`  ✅ Session ${session._id} - Changed PIN from ${pin} to ${newPin}`);
        } else {
          console.log(`  ❌ Failed to generate unique PIN for session ${session._id}`);
        }
      }
    }
    
    console.log('\n✅ Duplicate PIN fix completed!');
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing duplicate PINs:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

