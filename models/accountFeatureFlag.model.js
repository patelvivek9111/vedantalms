const mongoose = require('mongoose');

/** Canvas-style feature flags scoped to a root account. */
const accountFeatureFlagSchema = new mongoose.Schema(
  {
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

accountFeatureFlagSchema.index({ rootAccountId: 1, key: 1 }, { unique: true });

accountFeatureFlagSchema.statics.isEnabled = async function (rootAccountId, key, defaultValue = false) {
  if (!rootAccountId || !key) return defaultValue;
  const row = await this.findOne({ rootAccountId, key }).lean();
  if (!row) return defaultValue;
  return Boolean(row.enabled);
};

module.exports = mongoose.model('AccountFeatureFlag', accountFeatureFlagSchema);
