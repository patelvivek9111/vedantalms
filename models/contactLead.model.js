const mongoose = require('mongoose');

/** Sales/ops lead from public Contact form — can be provisioned into a root Account. */
const contactLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    organization: { type: String, required: true, trim: true, maxlength: 200 },
    jobTitle: { type: String, required: true, trim: true, maxlength: 120 },
    userCount: { type: String, required: true, trim: true, maxlength: 80 },
    extra: { type: String, default: '', maxlength: 5000 },
    status: {
      type: String,
      enum: ['new', 'contacted', 'provisioned', 'rejected'],
      default: 'new',
      index: true,
    },
    provisionedRootAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    provisionedAt: { type: Date, default: null },
    provisionedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true }
);

contactLeadSchema.index({ email: 1, createdAt: -1 });
contactLeadSchema.index({ organization: 1, status: 1 });

module.exports = mongoose.model('ContactLead', contactLeadSchema);
