const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Staged SIS enrollment rows — never writes grades directly.
 * Review/approve before applying to Enrollment + Course.students.
 */
const sisStagingEnrollmentSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['banner', 'peoplesoft', 'workday', 'csv'],
      required: true,
    },
    externalStudentId: { type: String, required: true },
    externalCourseId: { type: String, required: true },
    studentEmail: String,
    courseCode: String,
    term: String,
    year: Number,
    academicTermId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicTerm',
      default: null,
    },
    lmsCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    resolvedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'applied'],
      default: 'pending',
    },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    appliedAt: Date,
    applyError: { type: String, default: '' },
    batchId: { type: String, index: true },
  },
  { timestamps: true }
);

sisStagingEnrollmentSchema.plugin(tenantScopePlugin);

sisStagingEnrollmentSchema.index({ rootAccountId: 1, provider: 1, status: 1, createdAt: -1 });
sisStagingEnrollmentSchema.index({ rootAccountId: 1, batchId: 1 });
sisStagingEnrollmentSchema.index({
  rootAccountId: 1,
  externalStudentId: 1,
  externalCourseId: 1,
});

module.exports = mongoose.model('SisStagingEnrollment', sisStagingEnrollmentSchema);
