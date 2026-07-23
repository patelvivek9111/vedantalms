const mongoose = require('mongoose');
const crypto = require('crypto');

const ACCOUNT_INVITE_ROLES = [
  'student',
  'teaching_assistant',
  'teacher',
  'designer',
  'observer',
  'department_admin',
  'registrar',
  'admin',
];

const accountInviteSchema = new mongoose.Schema(
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
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ACCOUNT_INVITE_ROLES,
      default: 'student',
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

accountInviteSchema.index({ rootAccountId: 1, email: 1, acceptedAt: 1 });
accountInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

accountInviteSchema.statics.hashToken = function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

accountInviteSchema.statics.createInvite = async function createInvite({
  rootAccountId,
  accountId,
  email,
  role,
  invitedBy,
  ttlHours = 72,
}) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const doc = await this.create({
    rootAccountId,
    accountId: accountId || rootAccountId,
    email: String(email).toLowerCase().trim(),
    role: role || 'student',
    invitedBy,
    tokenHash: this.hashToken(rawToken),
    expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
  });
  return { invite: doc, rawToken };
};

module.exports = mongoose.model('AccountInvite', accountInviteSchema);
module.exports.ACCOUNT_INVITE_ROLES = ACCOUNT_INVITE_ROLES;
