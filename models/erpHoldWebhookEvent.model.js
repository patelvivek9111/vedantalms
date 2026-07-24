const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Inbound ERP hold webhook events — retry + dead-letter.
 */
const erpHoldWebhookEventSchema = new mongoose.Schema(
  {
    externalHoldId: { type: String, default: '', index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    signatureValid: { type: Boolean, default: false },
    authMethod: {
      type: String,
      enum: ['hmac', 'shared_secret', 'none', 'invalid'],
      default: 'none',
    },
    status: {
      type: String,
      enum: ['received', 'processing', 'applied', 'failed', 'dead_letter'],
      default: 'received',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastError: { type: String, default: '' },
    holdId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentHold', default: null },
    processedAt: { type: Date, default: null },
    nextRetryAt: { type: Date, default: null },
  },
  { timestamps: true }
);

erpHoldWebhookEventSchema.plugin(tenantScopePlugin);
erpHoldWebhookEventSchema.index({ rootAccountId: 1, status: 1, nextRetryAt: 1 });
erpHoldWebhookEventSchema.index({ rootAccountId: 1, createdAt: -1 });

module.exports = mongoose.model('ErpHoldWebhookEvent', erpHoldWebhookEventSchema);
