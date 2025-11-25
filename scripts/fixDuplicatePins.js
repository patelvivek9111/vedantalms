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
    
    // Validate sessions array
    if (!Array.isArray(sessions)) {
      throw new Error('Invalid sessions array returned from database');
    }

    // Group by gamePin
    const pinGroups = {};
    sessions.forEach(session => {
      if (session && session.gamePin && typeof session.gamePin === 'string') {
        const pin = session.gamePin;
        // Validate PIN format (6-digit numeric)
        if (/^\d{6}$/.test(pin)) {
          if (!pinGroups[pin]) {
            pinGroups[pin] = [];
          }
          pinGroups[pin].push(session);
        } else {
          console.warn(`⚠️  Invalid PIN format found: ${pin} for session ${session._id}`);
        }
      }
    });
    
    // Find duplicates
    const duplicates = Object.entries(pinGroups).filter(([pin, sessions]) => sessions.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate PINs found!');
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
      }
      process.exit(0);
    }
    
    console.log(`⚠️  Found ${duplicates.length} duplicate PIN(s):`);
    
    // Fix duplicates by regenerating PINs for all but the first session
    for (const [pin, duplicateSessions] of duplicates) {
      if (!Array.isArray(duplicateSessions) || duplicateSessions.length < 2) {
        continue;
      }

      console.log(`\n📌 PIN ${pin} has ${duplicateSessions.length} sessions:`);
      
      // Sort by creation date - keep the oldest one
      duplicateSessions.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (isNaN(dateA) || isNaN(dateB)) {
          return 0;
        }
        return dateA - dateB;
      });
      
      // Regenerate PINs for all but the first (oldest) session
      for (let i = 1; i < duplicateSessions.length; i++) {
        const session = duplicateSessions[i];
        
        // Validate session has _id
        if (!session || !session._id) {
          console.log(`  ⚠️  Skipping invalid session at index ${i}`);
          continue;
        }

        let newPin;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (!isUnique && attempts < maxAttempts) {
          attempts++;
          newPin = Math.floor(100000 + Math.random() * 900000).toString();
          
          // Validate newPin format
          if (!/^\d{6}$/.test(newPin)) {
            continue;
          }

          try {
            const existing = await QuizSession.findOne({ gamePin: newPin });
            if (!existing) {
              isUnique = true;
            }
          } catch (dbError) {
            console.error(`  ❌ Database error checking PIN ${newPin}:`, dbError.message);
            break;
          }
        }
        
        if (isUnique && newPin) {
          try {
            const updateResult = await QuizSession.updateOne(
              { _id: session._id },
              { $set: { gamePin: newPin } }
            );
            
            if (updateResult && updateResult.modifiedCount === 1) {
              console.log(`  ✅ Session ${session._id} - Changed PIN from ${pin} to ${newPin}`);
            } else {
              console.log(`  ⚠️  Session ${session._id} - Update may have failed (modifiedCount: ${updateResult?.modifiedCount || 0})`);
            }
          } catch (updateError) {
            console.error(`  ❌ Error updating session ${session._id}:`, updateError.message);
          }
        } else {
          console.log(`  ❌ Failed to generate unique PIN for session ${session._id} after ${attempts} attempts`);
        }
      }
    }
    
    console.log('\n✅ Duplicate PIN fix completed!');
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close();
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing duplicate PINs:', error);
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close();
    }
    process.exit(1);
  }
}

