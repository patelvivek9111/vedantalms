const mongoose = require('mongoose');

const loginActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Allow null for failed login attempts where user doesn't exist
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  location: {
    type: String,
    default: 'Unknown'
  },
  success: {
    type: Boolean,
    default: true
  },
  failureReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
loginActivitySchema.index({ userId: 1, timestamp: -1 });

// TTL index to automatically delete records older than 5 months (150 days)
loginActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 150 * 24 * 60 * 60 });

module.exports = mongoose.model('LoginActivity', loginActivitySchema); 