const mongoose = require('mongoose');

/**
 * Account-level role permission overrides (Canvas RoleOverride).
 * enabled=true grants; enabled=false revokes a base capability for a role in an account.
 */
const roleOverrideSchema = new mongoose.Schema(
  {
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    permission: {
      type: String,
      required: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true }
);

roleOverrideSchema.index(
  { accountId: 1, role: 1, permission: 1 },
  { unique: true }
);

module.exports = mongoose.model('RoleOverride', roleOverrideSchema);
