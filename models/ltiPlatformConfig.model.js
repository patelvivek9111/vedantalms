const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Per-tenant LTI 1.3 platform / AGS configuration.
 * Env vars (LTI_*) act as global defaults when no tenant doc exists.
 */
const ltiPlatformConfigSchema = new mongoose.Schema(
  {
    issuer: { type: String, default: '' },
    clientId: { type: String, default: '' },
    clientSecret: { type: String, default: '' },
    deploymentId: { type: String, default: '' },
    jwksUrl: { type: String, default: '' },
    tokenUrl: { type: String, default: '' },
    /** AGS line items container URL (or template with {contextId}) */
    lineItemsUrl: { type: String, default: '' },
    scopes: {
      type: [String],
      default: [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      ],
    },
    agsEnabled: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ltiPlatformConfigSchema.plugin(tenantScopePlugin);
ltiPlatformConfigSchema.index(
  { rootAccountId: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('LtiPlatformConfig', ltiPlatformConfigSchema);
