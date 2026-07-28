const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Canvas-style reusable rubric (Phase 1).
 * Gradebook still uses Assignment.totalPoints / Submission.grade;
 * rubrics explain / (later) produce that number.
 */
const ratingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    longDescription: { type: String, default: '', trim: true },
    points: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const criterionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    longDescription: { type: String, default: '', trim: true },
    points: { type: Number, required: true, min: 0 },
    ratings: { type: [ratingSchema], default: [] },
  },
  { _id: false }
);

const rubricSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    criteria: { type: [criterionSchema], default: [] },
    pointsPossible: { type: Number, default: 0, min: 0 },
    freeFormCriterionComments: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workflowState: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
    },
  },
  { timestamps: true }
);

rubricSchema.plugin(tenantScopePlugin);
rubricSchema.index({ rootAccountId: 1, courseId: 1, workflowState: 1, updatedAt: -1 });
rubricSchema.index({ rootAccountId: 1, title: 1 });

module.exports = mongoose.models.Rubric || mongoose.model('Rubric', rubricSchema);
