const mongoose = require('mongoose');

const ConversationParticipantSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastReadAt: { type: Date },
  folder: { type: String, enum: ['inbox', 'sent', 'archived', 'deleted'], default: 'inbox' },
  starred: { type: Boolean, default: false },
});

ConversationParticipantSchema.index({ userId: 1, folder: 1, updatedAt: -1 });
ConversationParticipantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ConversationParticipant', ConversationParticipantSchema); 