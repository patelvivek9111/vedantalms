const mongoose = require('mongoose');

/**
 * Wait for MongoDB connection to be established
 * @param {string} uri - MongoDB connection URI
 * @param {number} maxAttempts - Maximum number of connection attempts
 * @param {number} delay - Delay between attempts in milliseconds
 */
const waitForMongoConnection = async (uri, maxAttempts = 10, delay = 1000) => {
  // If already connected, return
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', resolve);
    });
    if (mongoose.connection.readyState === 1) {
      return;
    }
  }

  // Try to connect
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
      }
      
      // Wait a bit for connection to stabilize
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      if (mongoose.connection.readyState === 1) {
        return;
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`Failed to connect to MongoDB after ${maxAttempts} attempts: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Failed to connect to MongoDB after ${maxAttempts} attempts`);
};

module.exports = {
  waitForMongoConnection
};
