const mongoose = require('mongoose');
const { immutableAppendOnlyPlugin } = require('./plugins/immutableAppendOnly.plugin');

/**
 * Append-only amendment record; prior finalized snapshots remain queryable via superseded flags.
 */
const gradeAmendmentRecordSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    term: { type: String, required: true },
    year: { type: Number, required: true },
    lifecycle: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseGradeLifecycle', required: true },
    amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 1000 },
    sequence: { type: Number, required: true },
    beforePolicyHash: String,
    afterPolicyHash: String,
    beforePolicyVersion: Number,
    afterPolicyVersion: Number,
    beforeGradingEngineVersion: String,
    afterGradingEngineVersion: String,
    beforeLifecycleStatus: String,
    studentCount: { type: Number, default: 0 },
    snapshotSummary: {
      type: [
        {
          student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          beforePercent: Number,
          beforeLetter: String,
          afterPercent: Number,
          afterLetter: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

gradeAmendmentRecordSchema.index({ course: 1, term: 1, year: 1, sequence: -1 });
gradeAmendmentRecordSchema.index({ lifecycle: 1 });

gradeAmendmentRecordSchema.plugin(immutableAppendOnlyPlugin, { mode: 'amendment' });

module.exports = mongoose.model('GradeAmendmentRecord', gradeAmendmentRecordSchema);
