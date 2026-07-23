const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Institution-level grading period template for an AcademicTerm.
 * Course periods can inherit from these on apply.
 */
const institutionGradingPeriodSchema = new mongoose.Schema(
  {
    academicTermId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicTerm',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    position: { type: Number, default: 0 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    closeDate: { type: Date, default: null },
    weight: { type: Number, default: null },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

institutionGradingPeriodSchema.plugin(tenantScopePlugin);

institutionGradingPeriodSchema.index(
  { rootAccountId: 1, academicTermId: 1, position: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('InstitutionGradingPeriod', institutionGradingPeriodSchema);
