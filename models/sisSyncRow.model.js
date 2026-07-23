const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Per-row SIS staging with proposed/current/diff for inbox review.
 */
const sisSyncRowSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    entityType: {
      type: String,
      enum: ['user', 'section', 'enrollment'],
      required: true,
    },
    externalKey: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'applied', 'conflict'],
      default: 'pending',
    },
    proposed: { type: mongoose.Schema.Types.Mixed, default: {} },
    current: { type: mongoose.Schema.Types.Mixed, default: null },
    diff: { type: mongoose.Schema.Types.Mixed, default: null },
    overrideReason: { type: String, default: '' },
    applyError: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    appliedAt: { type: Date, default: null },
    resolvedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedSectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseSection', default: null },
    resolvedCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

sisSyncRowSchema.plugin(tenantScopePlugin);
sisSyncRowSchema.index({ rootAccountId: 1, batchId: 1, status: 1 });
sisSyncRowSchema.index({ rootAccountId: 1, entityType: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('SisSyncRow', sisSyncRowSchema);
