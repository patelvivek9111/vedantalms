const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true },
  attachments: [{ type: String }], // URLs or file references
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('Message', MessageSchema); 