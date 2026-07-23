const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Canvas Section — term instance of an offering, linked to LMS Course content.
 */
const courseSectionSchema = new mongoose.Schema(
  {
    offeringId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseOffering',
      required: true,
      index: true,
    },
    academicTermId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicTerm',
      required: true,
      index: true,
    },
    sectionNumber: { type: String, required: true, trim: true, maxlength: 32 },
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    teachingAssistantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    meetingPattern: { type: String, default: '', trim: true },
    maxEnrollment: { type: Number, default: null },
    minEnrollment: { type: Number, default: 0 },
    enrollmentMethod: {
      type: String,
      enum: ['open', 'approval', 'registrar_only', 'sis_only'],
      default: 'open',
    },
    status: {
      type: String,
      enum: ['planned', 'published', 'concluded', 'cancelled'],
      default: 'planned',
      index: true,
    },
    concludeDate: { type: Date, default: null },
    sisSectionId: { type: String, default: '', trim: true },
    crossListGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CrossListGroup',
      default: null,
      index: true,
    },
    primarySectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseSection',
      default: null,
    },
    /** Existing LMS Course document (content + roster during transition). */
    lmsCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

courseSectionSchema.plugin(tenantScopePlugin);

courseSectionSchema.index(
  { rootAccountId: 1, academicTermId: 1, offeringId: 1, sectionNumber: 1 },
  { unique: true }
);
courseSectionSchema.index({ rootAccountId: 1, accountId: 1, status: 1 });
courseSectionSchema.index(
  { rootAccountId: 1, sisSectionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rootAccountId: { $type: 'objectId' },
      sisSectionId: { $type: 'string', $gt: '' },
    },
  }
);

module.exports = mongoose.model('CourseSection', courseSectionSchema);
