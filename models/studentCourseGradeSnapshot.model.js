const mongoose = require('mongoose');
const { courseChildTenantPlugin } = require('./plugins/courseChildTenant.plugin');
const { immutableAppendOnlyPlugin } = require('./plugins/immutableAppendOnly.plugin');

/**
 * Frozen course grade + resolved policy snapshot for transcript reproducibility.
 * Unique per student + course + academic term/year when term/year are set.
 */
const studentCourseGradeSnapshotSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    term: {
      type: String,
      default: null,
    },
    year: {
      type: Number,
      default: null,
    },
    finalPercent: {
      type: Number,
      required: true,
    },
    letterGrade: {
      type: String,
      required: true,
    },
    gradingPolicyVersion: {
      type: Number,
      required: true,
    },
    gradingPolicyHash: {
      type: String,
      required: true,
    },
    gradingPolicySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    gradingEngineVersion: {
      type: String,
    },
    lifecycleStatus: {
      type: String,
      enum: ['DRAFT', 'POSTED', 'FINALIZED', 'AMENDED', null],
      default: null,
    },
    frozen: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      enum: ['transcript', 'gradebook', 'manual'],
      default: 'transcript',
    },
    computedAt: {
      type: Date,
      default: Date.now,
    },
    isCurrent: {
      type: Boolean,
      default: true,
    },
    amendmentSequence: {
      type: Number,
      default: 0,
    },
    amendmentRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GradeAmendmentRecord',
    },
    supersededAt: Date,
  },
  { timestamps: true }
);

studentCourseGradeSnapshotSchema.index(
  { student: 1, course: 1, term: 1, year: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isCurrent: true,
      term: { $type: 'string' },
      year: { $type: 'number' },
    },
  }
);

studentCourseGradeSnapshotSchema.index({ student: 1, course: 1 });

studentCourseGradeSnapshotSchema.plugin(immutableAppendOnlyPlugin, { mode: 'snapshot' });
const { portabilityMetadataPlugin } = require('./plugins/portabilityMetadata.plugin');
studentCourseGradeSnapshotSchema.plugin(portabilityMetadataPlugin);

studentCourseGradeSnapshotSchema.plugin(courseChildTenantPlugin, { coursePath: 'course' });

module.exports = mongoose.model('StudentCourseGradeSnapshot', studentCourseGradeSnapshotSchema);
