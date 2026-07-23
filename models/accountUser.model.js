const mongoose = require('mongoose');

/**
 * Canvas AccountUser — membership of a User in an Account (root or sub-account).
 * A person may have multiple AccountUser rows across institutions.
 */
const ACCOUNT_USER_ROLES = [
  'student',
  'teaching_assistant',
  'teacher',
  'designer',
  'observer',
  'department_admin',
  'registrar',
  'admin',
  'platform_admin',
];

const accountUserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    roles: {
      type: [
        {
          type: String,
          enum: ACCOUNT_USER_ROLES,
        },
      ],
      default: ['student'],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one role is required',
      },
    },
    workflowState: {
      type: String,
      enum: ['active', 'deleted', 'pending'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

accountUserSchema.index({ userId: 1, accountId: 1 }, { unique: true });
accountUserSchema.index({ rootAccountId: 1, workflowState: 1, roles: 1 });

accountUserSchema.statics.ACCOUNT_USER_ROLES = ACCOUNT_USER_ROLES;

module.exports = mongoose.model('AccountUser', accountUserSchema);
module.exports.ACCOUNT_USER_ROLES = ACCOUNT_USER_ROLES;
