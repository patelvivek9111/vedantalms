const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

const LIFECYCLE_STATUSES = ['DRAFT', 'POSTED', 'FINALIZED', 'AMENDED'];

const courseGradeLifecycleSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    term: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: LIFECYCLE_STATUSES,
      default: 'DRAFT',
    },
    postedAt: Date,
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalizedAt: Date,
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amendedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseGradeLifecycle' },
    amendmentReason: { type: String, maxlength: 1000 },
    policyHash: String,
    policyVersion: Number,
    gradingEngineVersion: String,
    transcriptSnapshotBatchId: String,
    studentSnapshotCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

courseGradeLifecycleSchema.plugin(tenantScopePlugin);

courseGradeLifecycleSchema.index({ course: 1, term: 1, year: 1 }, { unique: true });
courseGradeLifecycleSchema.index({ course: 1, status: 1 });
courseGradeLifecycleSchema.index({ rootAccountId: 1, status: 1, term: 1, year: 1 });

courseGradeLifecycleSchema.statics.STATUSES = LIFECYCLE_STATUSES;

module.exports = mongoose.model('CourseGradeLifecycle', courseGradeLifecycleSchema);
