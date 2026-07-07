const mongoose = require('mongoose');

const courseGradingPeriodSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    position: { type: Number, default: 0 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    closed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

courseGradingPeriodSchema.index({ course: 1, position: 1 });

module.exports =
  mongoose.models.CourseGradingPeriod ||
  mongoose.model('CourseGradingPeriod', courseGradingPeriodSchema);
