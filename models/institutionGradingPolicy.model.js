const mongoose = require('mongoose');
const { DEFAULT_GRADING_POLICY } = require('../shared/grading/policyDefaults.cjs');

const institutionGradingPolicySchema = new mongoose.Schema(
  {
    /** Singleton key — only one institution policy document. */
    key: { type: String, default: 'default', unique: true },
    version: { type: Number, default: 1 },
    policy: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_GRADING_POLICY }),
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

institutionGradingPolicySchema.statics.getPolicy = async function () {
  let doc = await this.findOne({ key: 'default' });
  if (!doc) {
    doc = await this.create({ key: 'default', policy: { ...DEFAULT_GRADING_POLICY } });
  }
  return doc;
};

module.exports = mongoose.model('InstitutionGradingPolicy', institutionGradingPolicySchema);
