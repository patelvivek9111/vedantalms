const mongoose = require('mongoose');
const { courseChildTenantPlugin } = require('./plugins/courseChildTenant.plugin');

/**
 * Canvas-style materialized enrollment grades for fast dashboard reads.
 * Updated when grades change (write path), not recomputed on dashboard load.
 */
const courseEnrollmentGradeSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentPercent: { type: Number, default: null },
    finalPercent: { type: Number, default: null },
    totalPercent: { type: Number, default: null },
    letterGrade: { type: String, default: '' },
    finalLetterGrade: { type: String, default: '' },
    policyHash: { type: String, default: '' },
    engineVersion: { type: String, default: '' },
    computedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

courseEnrollmentGradeSchema.index({ course: 1, student: 1 }, { unique: true });
courseEnrollmentGradeSchema.index({ student: 1, course: 1 });

courseEnrollmentGradeSchema.plugin(courseChildTenantPlugin, { coursePath: 'course' });

module.exports =
  mongoose.models.CourseEnrollmentGrade ||
  mongoose.model('CourseEnrollmentGrade', courseEnrollmentGradeSchema);
