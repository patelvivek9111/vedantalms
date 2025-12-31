const mongoose = require('mongoose');

const ConversationParticipantSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastReadAt: { type: Date },
  folder: { type: String, enum: ['inbox', 'sent', 'archived', 'deleted'], default: 'inbox' },
  starred: { type: Boolean, default: false },
});

module.exports = mongoose.model('ConversationParticipant', ConversationParticipantSchema); 