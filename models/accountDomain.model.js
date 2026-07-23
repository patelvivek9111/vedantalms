const mongoose = require('mongoose');

/**
 * Hostnames that resolve to a root Account (Canvas vanity / subdomain).
 * Example: springfield.mysl8te.com → rootAccountId
 */
const accountDomainSchema = new mongoose.Schema(
  {
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    host: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 253,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isCustomDomain: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationToken: {
      type: String,
      default: '',
      trim: true,
    },
    tlsStatus: {
      type: String,
      enum: ['none', 'pending', 'active', 'failed'],
      default: 'none',
    },
    tlsLastError: {
      type: String,
      default: '',
      trim: true,
    },
    certificateExpiresAt: {
      type: Date,
      default: null,
    },
    certificatePath: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

accountDomainSchema.index({ host: 1 }, { unique: true });
accountDomainSchema.index({ rootAccountId: 1, isPrimary: -1 });

accountDomainSchema.statics.normalizeHost = function (raw) {
  if (!raw) return '';
  let host = String(raw).trim().toLowerCase();
  // Strip port and protocol leftovers
  host = host.replace(/^https?:\/\//, '');
  host = host.split('/')[0];
  host = host.split(':')[0];
  if (host.startsWith('www.')) host = host.slice(4);
  return host;
};

module.exports = mongoose.model('AccountDomain', accountDomainSchema);
