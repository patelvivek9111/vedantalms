const mongoose = require('mongoose');
const { DEFAULT_GRADING_POLICY } = require('../shared/grading/policyDefaults.cjs');
const { tenantScopePlugin } = require('./plugins/tenantScope.plugin');

const institutionGradingPolicySchema = new mongoose.Schema(
  {
    /** Legacy singleton key; new docs use account:<rootAccountId>. */
    key: { type: String, default: 'default', index: true },
    version: { type: Number, default: 1 },
    policy: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_GRADING_POLICY }),
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

institutionGradingPolicySchema.plugin(tenantScopePlugin, { skipDefaultIndexes: true });

institutionGradingPolicySchema.index(
  { rootAccountId: 1 },
  { unique: true, partialFilterExpression: { rootAccountId: { $type: 'objectId' } } }
);

/**
 * @param {import('mongoose').Types.ObjectId|string} [rootAccountId]
 */
institutionGradingPolicySchema.statics.getPolicy = async function (rootAccountId) {
  const { getTenantRootAccountId } = require('../utils/tenantContext');
  const id = rootAccountId || getTenantRootAccountId();

  if (id) {
    let doc = await this.findOne({ rootAccountId: id });
    if (!doc) {
      const orphan = await this.findOne({
        $or: [{ key: 'default' }, { rootAccountId: null }, { rootAccountId: { $exists: false } }],
      });
      if (orphan && !orphan.rootAccountId) {
        orphan.rootAccountId = id;
        orphan.accountId = id;
        orphan.key = `account:${id}`;
        await orphan.save();
        return orphan;
      }
      doc = await this.create({
        key: `account:${id}`,
        rootAccountId: id,
        accountId: id,
        policy: { ...DEFAULT_GRADING_POLICY },
      });
    }
    return doc;
  }

  let doc = await this.findOne({ key: 'default' });
  if (!doc) {
    doc = await this.create({ key: 'default', policy: { ...DEFAULT_GRADING_POLICY } });
  }
  return doc;
};

module.exports = mongoose.model('InstitutionGradingPolicy', institutionGradingPolicySchema);
