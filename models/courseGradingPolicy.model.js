const mongoose = require('mongoose');
const { courseChildTenantPlugin } = require('./plugins/courseChildTenant.plugin');

const courseGradingPolicySchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      unique: true,
      index: true,
    },
    version: { type: Number, default: 1 },
    /** Policy flags (missing, late, drop, caps, attendance, gpa). */
    policy: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Optional override of groups (else uses course.groups). */
    groups: [
      {
        name: { type: String, required: true },
        weight: { type: Number, required: true },
      },
    ],
    /** Optional override of letter scale. */
    gradeScale: [
      {
        letter: { type: String, required: true },
        min: { type: Number, required: true },
        max: { type: Number, required: true },
      },
    ],
    /** Future: per-teacher overrides stored separately; placeholder for extensibility. */
    allowTeacherOverrides: { type: Boolean, default: false },
    /** How mid-course policy changes apply to already-graded work. */
    applyMode: {
      type: String,
      enum: ['retroactive_all', 'prospective_only', 'from_assignment'],
      default: 'retroactive_all',
    },
    /** Cutoff for prospective_only — work graded before this uses submission policy snapshot. */
    effectiveAt: { type: Date, default: null },
    effectiveAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null,
    },
    /** Policy in effect before last prospective/from_assignment change (for legacy rule resolution). */
    legacyPolicySnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

courseGradingPolicySchema.statics.findByCourseId = function (courseId) {
  return this.findOne({ course: courseId }).lean();
};

courseGradingPolicySchema.plugin(courseChildTenantPlugin, { coursePath: 'course' });

module.exports = mongoose.model('CourseGradingPolicy', courseGradingPolicySchema);
