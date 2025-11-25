const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { QuizSession } = require('../models/quizwave.model');

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    console.log('🔧 Fixing PIN index issue...\n');
    
    try {
      // Validate database connection
      if (!mongoose.connection.db) {
        throw new Error('Database connection not available');
      }

      const collection = mongoose.connection.db.collection('quizsessions');
      
      // Validate collection exists
      if (!collection) {
        throw new Error('Collection not found');
      }
      
      // List all indexes
      console.log('📋 Current indexes:');
      const indexes = await collection.indexes();
      
      // Validate indexes array
      if (!Array.isArray(indexes)) {
        throw new Error('Invalid indexes array returned');
      }

      indexes.forEach(idx => {
        if (idx && idx.name && idx.key) {
          console.log(`  - ${idx.name}:`, idx.key);
        }
      });
      
      // Check for old 'pin' index
      const pinIndex = indexes.find(idx => 
        idx && (idx.name === 'pin_1' || (idx.key && idx.key.pin))
      );
      if (pinIndex && pinIndex.name) {
        console.log(`\n⚠️  Found old 'pin' index: ${pinIndex.name}`);
        console.log('🗑️  Dropping old index...');
        try {
          await collection.dropIndex(pinIndex.name);
          console.log('✅ Old index dropped');
        } catch (dropError) {
          console.error(`⚠️  Error dropping index: ${dropError.message}`);
          // Continue even if drop fails
        }
      }
      
      // Check for documents with null pin
      console.log('\n🔍 Checking for documents with null pin...');
      try {
        const nullPinDocs = await collection.find({ pin: null }).toArray();
        const nullPinCount = Array.isArray(nullPinDocs) ? nullPinDocs.length : 0;
        
        if (nullPinCount > 0) {
          console.log(`⚠️  Found ${nullPinCount} documents with null pin`);
          console.log('🗑️  Deleting these documents...');
          const deleteResult = await collection.deleteMany({ pin: null });
          const deletedCount = deleteResult && typeof deleteResult.deletedCount === 'number' 
            ? deleteResult.deletedCount 
            : 0;
          console.log(`✅ ${deletedCount} documents deleted`);
        } else {
          console.log('✅ No documents with null pin found');
        }
      } catch (nullPinError) {
        console.error(`⚠️  Error checking/deleting null pin documents: ${nullPinError.message}`);
        // Continue even if this fails
      }
      
      // Ensure gamePin index exists
      console.log('\n🔍 Checking gamePin index...');
      const gamePinIndex = indexes.find(idx => 
        idx && (idx.name === 'gamePin_1' || (idx.key && idx.key.gamePin))
      );
      if (!gamePinIndex) {
        console.log('📌 Creating gamePin index...');
        try {
          await collection.createIndex({ gamePin: 1 }, { unique: true });
          console.log('✅ gamePin index created');
        } catch (createError) {
          console.error(`❌ Error creating gamePin index: ${createError.message}`);
          throw createError;
        }
      } else {
        console.log('✅ gamePin index already exists');
      }
      
      // List indexes again
      console.log('\n📋 Updated indexes:');
      const newIndexes = await collection.indexes();
      if (Array.isArray(newIndexes)) {
        newIndexes.forEach(idx => {
          if (idx && idx.name && idx.key) {
            console.log(`  - ${idx.name}:`, idx.key);
          }
        });
      }
      
      console.log('\n✅ Fix completed!');
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
      }
      process.exit(0);
    } catch (error) {
      console.error('\n❌ ERROR:', error.message);
      console.error('Full error:', error);
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

