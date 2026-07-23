const mongoose = require('mongoose');

/**
 * Per-root authentication provider config (Canvas AuthenticationProvider).
 * Phase 2 ships `password` as the active provider; SAML/OIDC/Google schemas are ready.
 */
const authenticationProviderSchema = new mongoose.Schema(
  {
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    authType: {
      type: String,
      enum: ['password', 'google', 'microsoft', 'saml', 'oidc'],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    workflowState: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
    },
    position: {
      type: Number,
      default: 0,
    },
    /** Provider-specific settings (clientId, metadataUrl, etc.) — never log secrets */
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    jitProvisioning: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

authenticationProviderSchema.index({ rootAccountId: 1, authType: 1, workflowState: 1 });

authenticationProviderSchema.statics.ensurePasswordProvider = async function (rootAccountId) {
  let doc = await this.findOne({
    rootAccountId,
    authType: 'password',
    workflowState: 'active',
  });
  if (!doc) {
    doc = await this.create({
      rootAccountId,
      authType: 'password',
      name: 'Email and password',
      position: 0,
      settings: {},
    });
  }
  return doc;
};

module.exports = mongoose.model('AuthenticationProvider', authenticationProviderSchema);
