const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * SIS import/export job metadata per root account.
 */
const sisJobSchema = new mongoose.Schema(
  {
    jobType: {
      type: String,
      enum: [
        'enrollment_import',
        'enrollment_export',
        'grade_export',
        'user_import',
        'section_import',
        'scheduled_sync',
      ],
      required: true,
    },
    provider: {
      type: String,
      enum: ['banner', 'peoplesoft', 'workday', 'csv', 'custom_rest', 'fedena', 'mastersoft'],
      default: 'csv',
    },
    batchId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'partial'],
      default: 'queued',
    },
    stagedCount: { type: Number, default: 0 },
    appliedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finishedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

sisJobSchema.plugin(tenantScopePlugin);
sisJobSchema.index({ rootAccountId: 1, createdAt: -1 });

module.exports = mongoose.model('SisJob', sisJobSchema);
