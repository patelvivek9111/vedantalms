const mongoose = require('mongoose');

/**
 * Pre-loaded student roster for self-service account activation.
 * Does NOT create login accounts — only lists students allowed to claim.
 */
const pendingStudentRosterSchema = new mongoose.Schema(
  {
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    middleName: {
      type: String,
      default: '',
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'claimed'],
      default: 'pending',
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    claimedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /** Set when form middle name differs from roster (informational for registrar). */
    middleNameMismatch: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

pendingStudentRosterSchema.index(
  { rootAccountId: 1, studentId: 1 },
  { unique: true }
);
pendingStudentRosterSchema.index({ rootAccountId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('PendingStudentRoster', pendingStudentRosterSchema);
