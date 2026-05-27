const mongoose = require('mongoose');

const submissionVersionSchema = new mongoose.Schema(
  {
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
    },
    version: {
      type: Number,
      required: true,
    },
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    submissionText: String,
    files: [String],
    fileAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileAsset' }],
    submittedAt: Date,
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    autoGradeSnapshot: {
      autoGraded: Boolean,
      autoGrade: Number,
      autoQuestionGrades: mongoose.Schema.Types.Mixed,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

submissionVersionSchema.index({ submission: 1, version: 1 }, { unique: true });

module.exports = mongoose.models.SubmissionVersion || mongoose.model('SubmissionVersion', submissionVersionSchema);
