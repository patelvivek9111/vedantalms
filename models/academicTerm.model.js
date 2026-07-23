const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Canvas Enrollment Term — institution-wide academic term registry.
 */
const academicTermSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    termType: {
      type: String,
      enum: ['semester', 'trimester', 'quarter', 'annual', 'summer', 'custom'],
      default: 'semester',
    },
    /** Legacy Course.semester.term mirror (Fall, Spring, …) */
    legacyTermLabel: { type: String, default: '', trim: true },
    legacyYear: { type: Number, default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    enrollmentOpenDate: { type: Date, default: null },
    enrollmentCloseDate: { type: Date, default: null },
    gradingPeriodCloseDate: { type: Date, default: null },
    finalizeDeadline: { type: Date, default: null },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'grading', 'closed', 'archived'],
      default: 'upcoming',
      index: true,
    },
    sisTermCode: { type: String, default: '', trim: true },
    academicYearLabel: { type: String, default: '', trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

academicTermSchema.plugin(tenantScopePlugin);

academicTermSchema.index(
  { rootAccountId: 1, code: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);
academicTermSchema.index({ rootAccountId: 1, status: 1, startDate: 1 });

academicTermSchema.statics.isEnrollmentOpen = function isEnrollmentOpen(term, at = new Date()) {
  if (!term) return true; // legacy courses without term
  if (term.status === 'closed' || term.status === 'archived') return false;
  if (term.enrollmentOpenDate && at < new Date(term.enrollmentOpenDate)) return false;
  if (term.enrollmentCloseDate && at > new Date(term.enrollmentCloseDate)) return false;
  return true;
};

module.exports = mongoose.model('AcademicTerm', academicTermSchema);
