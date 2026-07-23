const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Unified SIS sync batch (users / sections / enrollments / grade_export).
 */
const sisSyncBatchSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    entityType: {
      type: String,
      enum: ['user', 'section', 'enrollment', 'grade_export'],
      required: true,
    },
    provider: {
      type: String,
      enum: ['csv', 'banner', 'peoplesoft', 'workday', 'fedena', 'mastersoft', 'custom_rest'],
      default: 'csv',
    },
    status: {
      type: String,
      enum: ['staged', 'reviewing', 'applying', 'completed', 'failed', 'partial'],
      default: 'staged',
    },
    stagedCount: { type: Number, default: 0 },
    approvedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    appliedCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finishedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

sisSyncBatchSchema.plugin(tenantScopePlugin);
sisSyncBatchSchema.index({ rootAccountId: 1, createdAt: -1 });
sisSyncBatchSchema.index({ rootAccountId: 1, batchId: 1 }, { unique: true });

module.exports = mongoose.model('SisSyncBatch', sisSyncBatchSchema);
