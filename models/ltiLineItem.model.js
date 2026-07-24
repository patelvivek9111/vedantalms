const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Cached LTI AGS line item per LMS course / section.
 */
const ltiLineItemSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseSection', default: null },
    resourceLinkId: { type: String, default: '' },
    label: { type: String, default: 'Final grade' },
    scoreMaximum: { type: Number, default: 100 },
    lineItemId: { type: String, default: '' },
    lineItemUrl: { type: String, required: true },
    tag: { type: String, default: 'final' },
    lastSyncedAt: { type: Date, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ltiLineItemSchema.plugin(tenantScopePlugin);
ltiLineItemSchema.index({ rootAccountId: 1, courseId: 1, tag: 1 });

module.exports = mongoose.model('LtiLineItem', ltiLineItemSchema);
