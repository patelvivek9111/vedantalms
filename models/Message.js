const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  /** Legacy field; stores sanitized HTML (same as bodyHtml after Phase 1 writes). */
  body: { type: String, required: true },
  bodyHtml: { type: String },
  bodyText: { type: String },
  /** @deprecated Legacy URL strings; use fileAssetIds for new uploads. */
  attachments: [{ type: String }],
  fileAssetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' }],
}, { timestamps: { createdAt: true, updatedAt: false } });

MessageSchema.pre('validate', function syncBodyFields(next) {
  if (this.bodyHtml && !this.body) {
    this.body = this.bodyHtml;
  } else if (this.body && !this.bodyHtml) {
    this.bodyHtml = this.body;
  }
  if (this.bodyHtml && !this.bodyText) {
    const { htmlToPlainText } = require('../services/messageSanitizer.service');
    this.bodyText = htmlToPlainText(this.bodyHtml);
  }
  next();
});

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema); 