const mongoose = require('mongoose');

const gradebookCellHistorySchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    previousGrade: { type: mongoose.Schema.Types.Mixed, default: null },
    newGrade: { type: mongoose.Schema.Types.Mixed, default: null },
    previousExcused: { type: Boolean, default: false },
    newExcused: { type: Boolean, default: false },
    changeType: {
      type: String,
      enum: ['grade', 'excused', 'clear', 'post'],
      default: 'grade',
    },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

gradebookCellHistorySchema.index({ course: 1, student: 1, assignment: 1, createdAt: -1 });

module.exports =
  mongoose.models.GradebookCellHistory ||
  mongoose.model('GradebookCellHistory', gradebookCellHistorySchema);
