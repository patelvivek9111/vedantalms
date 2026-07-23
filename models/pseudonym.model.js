const mongoose = require('mongoose');

/**
 * Canvas Pseudonym — login identity scoped to a root account.
 * Password remains on User for backward compatibility; uniqueId is typically email.
 */
const pseudonymSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    uniqueId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    workflowState: {
      type: String,
      enum: ['active', 'deleted', 'suspended'],
      default: 'active',
    },
    authenticationProviderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuthenticationProvider',
      default: null,
    },
    /** External SSO subject when provider is not password */
    externalId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

pseudonymSchema.index({ rootAccountId: 1, uniqueId: 1 }, { unique: true });
pseudonymSchema.index({ userId: 1, rootAccountId: 1 });

module.exports = mongoose.model('Pseudonym', pseudonymSchema);
