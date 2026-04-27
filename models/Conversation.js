const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ createdBy: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema); 