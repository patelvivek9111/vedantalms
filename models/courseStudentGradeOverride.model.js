const mongoose = require('mongoose');

const courseStudentGradeOverrideSchema = new mongoose.Schema(
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
    finalPercent: { type: Number, required: true, min: 0, max: 200 },
    letterGrade: { type: String, default: null },
    reason: { type: String, default: '' },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

courseStudentGradeOverrideSchema.index(
  { course: 1, student: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

module.exports =
  mongoose.models.CourseStudentGradeOverride ||
  mongoose.model('CourseStudentGradeOverride', courseStudentGradeOverrideSchema);
