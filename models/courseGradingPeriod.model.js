const mongoose = require('mongoose');
const { courseChildTenantPlugin } = require('./plugins/courseChildTenant.plugin');

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
    // After this date, grades in the period are locked (Canvas "close date").
    closeDate: { type: Date, default: null },
    closed: { type: Boolean, default: false },
    // Optional Canvas-style period weight (percent). 0 / null → unweighted.
    weight: { type: Number, default: null },
  },
  { timestamps: true }
);

courseGradingPeriodSchema.index({ course: 1, position: 1 });

courseGradingPeriodSchema.plugin(courseChildTenantPlugin, { coursePath: 'course' });

module.exports =
  mongoose.models.CourseGradingPeriod ||
  mongoose.model('CourseGradingPeriod', courseGradingPeriodSchema);
