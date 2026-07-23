const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

/**
 * Canvas-style Account (root institution or sub-account in a tree).
 * Root accounts have parentAccountId=null and rootAccountId=self.
 */
const accountSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    /** Short stable code, unique among root accounts (e.g. DEFAULT, SPRINGFIELD). */
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 64,
    },
    parentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },
    /** Always the institution root; for roots equals this._id after save. */
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },
    workflowState: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    /** Commercial / ops plan label (detailed limits live on AccountQuota). */
    planCode: {
      type: String,
      enum: ['free', 'starter', 'standard', 'enterprise'],
      default: 'standard',
    },
    institutionMode: {
      type: String,
      enum: ['school', 'college', 'mixed'],
      default: 'mixed',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    affiliationBody: { type: String, default: '', trim: true },
    udiseCode: { type: String, default: '', trim: true },
    registrarContactEmail: { type: String, default: '', trim: true, lowercase: true },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

accountSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { parentAccountId: null, workflowState: { $ne: 'deleted' } },
  }
);
accountSchema.index({ rootAccountId: 1, parentAccountId: 1, name: 1 });

accountSchema.pre('save', async function (next) {
  if (this.parentAccountId) {
    if (!this.rootAccountId) {
      const parent = await this.constructor.findById(this.parentAccountId).select('rootAccountId').lean();
      this.rootAccountId = parent?.rootAccountId || this.parentAccountId;
    }
  } else if (!this.rootAccountId && this._id) {
    this.rootAccountId = this._id;
  }
  next();
});

accountSchema.post('save', async function (doc) {
  if (!doc.parentAccountId && (!doc.rootAccountId || String(doc.rootAccountId) !== String(doc._id))) {
    await doc.constructor.updateOne({ _id: doc._id }, { $set: { rootAccountId: doc._id } });
    doc.rootAccountId = doc._id;
  }
});

accountSchema.statics.isRoot = function (account) {
  return account && !account.parentAccountId;
};

accountSchema.methods.isRoot = function () {
  return !this.parentAccountId;
};

module.exports = mongoose.model('Account', accountSchema);
