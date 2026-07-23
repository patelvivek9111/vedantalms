const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Platform support acting-as-user session (Canvas masquerade analogue).
 */
const supportImpersonationSessionSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    ip: { type: String, default: '' },
    requestId: { type: String, default: '' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

supportImpersonationSessionSchema.plugin(tenantScopePlugin);
supportImpersonationSessionSchema.index({ rootAccountId: 1, isActive: 1, startedAt: -1 });

module.exports = mongoose.model('SupportImpersonationSession', supportImpersonationSessionSchema);
