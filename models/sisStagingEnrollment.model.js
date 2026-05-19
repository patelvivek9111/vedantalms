const mongoose = require('mongoose');

/**
 * Staged SIS enrollment rows — never writes grades directly.
 * Review/approve before applying to Course.students.
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
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'applied'],
      default: 'pending',
    },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    appliedAt: Date,
    batchId: { type: String, index: true },
  },
  { timestamps: true }
);

sisStagingEnrollmentSchema.index({ provider: 1, status: 1, createdAt: -1 });
sisStagingEnrollmentSchema.index({ externalStudentId: 1, externalCourseId: 1 });

module.exports = mongoose.model('SisStagingEnrollment', sisStagingEnrollmentSchema);
