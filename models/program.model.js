const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Academic program / degree track (college) or stream (school).
 */
const programSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 300 },
    level: {
      type: String,
      enum: ['ug', 'pg', 'diploma', 'school', 'certificate', 'other'],
      default: 'other',
    },
    durationTerms: { type: Number, default: 0 },
    requiredCredits: { type: Number, default: 0 },
    gradingScaleId: { type: mongoose.Schema.Types.ObjectId, default: null },
    /** Sub-account / department that owns this program */
    subAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

programSchema.plugin(tenantScopePlugin);

programSchema.index(
  { rootAccountId: 1, code: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);
programSchema.index({ rootAccountId: 1, subAccountId: 1, isActive: 1 });

module.exports = mongoose.model('Program', programSchema);
