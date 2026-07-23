const mongoose = require('mongoose');

/** Per-root-account branding (Canvas account brand). */
const accountBrandSchema = new mongoose.Schema(
  {
    rootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      unique: true,
    },
    displayName: { type: String, default: '', trim: true },
    wordmark: { type: String, default: 'MYSL8TE', trim: true },
    logoUrl: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#4F46E5' },
    secondaryColor: { type: String, default: '#7C3AED' },
    loginBackgroundUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

accountBrandSchema.statics.getForRoot = async function (rootAccountId) {
  if (!rootAccountId) return null;
  let doc = await this.findOne({ rootAccountId });
  if (!doc) {
    doc = await this.create({ rootAccountId });
  }
  return doc;
};

module.exports = mongoose.model('AccountBrand', accountBrandSchema);
