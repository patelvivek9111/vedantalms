const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

/**
 * Canvas-style enrollment of record (authoritative).
 * Phase 4 dual-writes with Course.students[] so teaching UX stays unchanged.
 */
const ENROLLMENT_STATUSES = [
  'invited',
  'active',
  'completed',
  'dropped',
  'withdrawn',
  'inactive',
  'rejected',
];

const ENROLLMENT_TYPES = ['regular', 'audit', 'pass_fail', 'honors', 'credit', 'no_credit'];

const ENROLLMENT_ROLES = ['student', 'ta', 'teacher', 'observer'];

const enrollmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Prefer CourseSection when available */
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseSection',
      default: null,
      index: true,
    },
    academicTermId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicTerm',
      default: null,
      index: true,
    },
    /** LMS Course content/roster container during transition */
    lmsCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ENROLLMENT_ROLES,
      default: 'student',
    },
    status: {
      type: String,
      enum: ENROLLMENT_STATUSES,
      default: 'active',
      index: true,
    },
    enrollmentType: {
      type: String,
      enum: ENROLLMENT_TYPES,
      default: 'regular',
    },
    enrolledAt: { type: Date, default: Date.now },
    droppedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    enrolledBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      source: {
        type: String,
        enum: ['self', 'teacher', 'admin', 'registrar', 'sis', 'system', 'invite'],
        default: 'system',
      },
    },
    sisEnrollmentId: { type: String, default: null, trim: true },
    gradeBasis: { type: String, default: '', trim: true },
    isOfficial: { type: Boolean, default: true },
    holdBlocked: { type: Boolean, default: false },
    lastSyncAt: { type: Date, default: null },
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'conflict', 'local'],
      default: 'local',
    },
    statusHistory: [
      {
        status: { type: String, enum: ENROLLMENT_STATUSES },
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

enrollmentSchema.plugin(tenantScopePlugin);

enrollmentSchema.index(
  { rootAccountId: 1, lmsCourseId: 1, studentId: 1 },
  { unique: true }
);
enrollmentSchema.index(
  { rootAccountId: 1, sectionId: 1, studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { sectionId: { $type: 'objectId' } },
  }
);
enrollmentSchema.index({ rootAccountId: 1, academicTermId: 1, studentId: 1 });
enrollmentSchema.index(
  { sisEnrollmentId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { sisEnrollmentId: { $type: 'string' } } }
);

enrollmentSchema.statics.STATUSES = ENROLLMENT_STATUSES;
enrollmentSchema.statics.TYPES = ENROLLMENT_TYPES;
enrollmentSchema.statics.ROLES = ENROLLMENT_ROLES;

module.exports = mongoose.model('Enrollment', enrollmentSchema);
