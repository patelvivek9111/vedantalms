const mongoose = require('mongoose');

const zohoMeetingConnectionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['zoho_meeting'],
      default: 'zoho_meeting',
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      default: '',
    },
    tokenType: {
      type: String,
      default: 'Bearer',
    },
    scope: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    accountEmail: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ZohoMeetingConnection', zohoMeetingConnectionSchema);
