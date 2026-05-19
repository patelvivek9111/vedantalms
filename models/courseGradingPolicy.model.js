const mongoose = require('mongoose');

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
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

courseGradingPolicySchema.statics.findByCourseId = function (courseId) {
  return this.findOne({ course: courseId }).lean();
};

module.exports = mongoose.model('CourseGradingPolicy', courseGradingPolicySchema);
