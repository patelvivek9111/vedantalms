const mongoose = require('mongoose');

const ConversationParticipantSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastReadAt: { type: Date },
  lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  /** Denormalized unread; authoritative when INBOX_DENORM_UNREAD=true. */
  unreadCount: { type: Number, default: 0, min: 0 },
  folder: { type: String, enum: ['inbox', 'sent', 'archived', 'deleted'], default: 'inbox' },
  starred: { type: Boolean, default: false },
}, { timestamps: true });

ConversationParticipantSchema.index({ userId: 1, folder: 1, updatedAt: -1 });
ConversationParticipantSchema.index({ userId: 1, unreadCount: 1 });
ConversationParticipantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ConversationParticipant', ConversationParticipantSchema); 