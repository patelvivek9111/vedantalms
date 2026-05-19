const mongoose = require('mongoose');

const gradingPolicyAuditSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    entityType: {
      type: String,
      enum: ['institution', 'course'],
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    oldPolicy: {
      type: mongoose.Schema.Types.Mixed,
    },
    newPolicy: {
      type: mongoose.Schema.Types.Mixed,
    },
    oldHash: {
      type: String,
    },
    newHash: {
      type: String,
    },
    diffSummary: {
      type: mongoose.Schema.Types.Mixed,
    },
    reason: {
      type: String,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

gradingPolicyAuditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
gradingPolicyAuditSchema.index({ actor: 1, createdAt: -1 });

const { portabilityMetadataPlugin } = require('./plugins/portabilityMetadata.plugin');
gradingPolicyAuditSchema.plugin(portabilityMetadataPlugin);

module.exports = mongoose.model('GradingPolicyAudit', gradingPolicyAuditSchema);
