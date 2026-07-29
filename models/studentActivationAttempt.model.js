const mongoose = require('mongoose');

/**
 * Audit + per-studentId lock for public account activation attempts.
 * Does not store full PII — studentId + tenant + result + IP hash is enough.
 */
const studentActivationAttemptSchema = new mongoose.Schema(
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
      index: true,
    },
    result: {
      type: String,
      enum: [
        'success',
        'not_found',
        'already_claimed',
        'name_mismatch',
        'locked',
        'mode_disabled',
        'honeypot',
        'error',
      ],
      required: true,
    },
    ipHash: {
      type: String,
      default: '',
      trim: true,
    },
    middleNameMismatch: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

studentActivationAttemptSchema.index({ rootAccountId: 1, studentId: 1, createdAt: -1 });
studentActivationAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('StudentActivationAttempt', studentActivationAttemptSchema);
