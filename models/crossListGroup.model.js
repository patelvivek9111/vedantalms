const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Cross-listed sections sharing content / optional shared gradebook.
 */
const crossListGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    primarySectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseSection',
      default: null,
    },
    sectionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CourseSection' }],
    sharedGradebook: { type: Boolean, default: true },
    sharedContentCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
  },
  { timestamps: true }
);

crossListGroupSchema.plugin(tenantScopePlugin);
crossListGroupSchema.index({ rootAccountId: 1, name: 1 });

module.exports = mongoose.model('CrossListGroup', crossListGroupSchema);
