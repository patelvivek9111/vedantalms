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
      const collection = mongoose.connection.db.collection('quizsessions');
      
      // List all indexes
      console.log('📋 Current indexes:');
      const indexes = await collection.indexes();
      indexes.forEach(idx => {
        console.log(`  - ${idx.name}:`, idx.key);
      });
      
      // Check for old 'pin' index
      const pinIndex = indexes.find(idx => idx.name === 'pin_1' || idx.key.pin);
      if (pinIndex) {
        console.log(`\n⚠️  Found old 'pin' index: ${pinIndex.name}`);
        console.log('🗑️  Dropping old index...');
        await collection.dropIndex(pinIndex.name);
        console.log('✅ Old index dropped');
      }
      
      // Check for documents with null pin
      console.log('\n🔍 Checking for documents with null pin...');
      const nullPinDocs = await collection.find({ pin: null }).toArray();
      if (nullPinDocs.length > 0) {
        console.log(`⚠️  Found ${nullPinDocs.length} documents with null pin`);
        console.log('🗑️  Deleting these documents...');
        await collection.deleteMany({ pin: null });
        console.log('✅ Documents deleted');
      } else {
        console.log('✅ No documents with null pin found');
      }
      
      // Ensure gamePin index exists
      console.log('\n🔍 Checking gamePin index...');
      const gamePinIndex = indexes.find(idx => idx.name === 'gamePin_1' || idx.key.gamePin);
      if (!gamePinIndex) {
        console.log('📌 Creating gamePin index...');
        await collection.createIndex({ gamePin: 1 }, { unique: true });
        console.log('✅ gamePin index created');
      } else {
        console.log('✅ gamePin index already exists');
      }
      
      // List indexes again
      console.log('\n📋 Updated indexes:');
      const newIndexes = await collection.indexes();
      newIndexes.forEach(idx => {
        console.log(`  - ${idx.name}:`, idx.key);
      });
      
      console.log('\n✅ Fix completed!');
      mongoose.connection.close();
      process.exit(0);
    } catch (error) {
      console.error('\n❌ ERROR:', error.message);
      console.error('Full error:', error);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

