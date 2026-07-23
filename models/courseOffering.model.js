const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Canvas catalog Course (offering) — reusable definition under an account/dept.
 * Live LMS content remains on `Course`; sections link offerings to terms.
 */
const courseOfferingSchema = new mongoose.Schema(
  {
    courseCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '', trim: true },
    credits: { type: Number, default: 0 },
    level: {
      type: String,
      enum: ['ug', 'pg', 'school', 'other'],
      default: 'other',
    },
    subjectCode: { type: String, default: '', trim: true, uppercase: true },
    prerequisites: [
      {
        courseCode: { type: String, trim: true },
        minGrade: { type: String, default: '' },
      },
    ],
    isActive: { type: Boolean, default: true },
    defaultGradingPolicyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    blueprintCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  },
  { timestamps: true }
);

courseOfferingSchema.plugin(tenantScopePlugin);

courseOfferingSchema.index(
  { rootAccountId: 1, courseCode: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);
courseOfferingSchema.index({ rootAccountId: 1, accountId: 1, isActive: 1 });

module.exports = mongoose.model('CourseOffering', courseOfferingSchema);
