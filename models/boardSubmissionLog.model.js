const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * India board / partner webhook submission log.
 */
const boardSubmissionLogSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, index: true },
    mode: {
      type: String,
      enum: ['export_only', 'partner_webhook', 'dry_run'],
      default: 'export_only',
    },
    status: {
      type: String,
      enum: ['preview', 'submitted', 'failed', 'skipped'],
      default: 'preview',
    },
    rowCount: { type: Number, default: 0 },
    httpStatus: { type: Number, default: null },
    responseBody: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

boardSubmissionLogSchema.plugin(tenantScopePlugin);
boardSubmissionLogSchema.index({ rootAccountId: 1, createdAt: -1 });

module.exports = mongoose.model('BoardSubmissionLog', boardSubmissionLogSchema);
