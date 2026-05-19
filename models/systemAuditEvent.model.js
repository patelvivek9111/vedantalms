const mongoose = require('mongoose');

const systemAuditEventSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    ip: String,
    requestId: String,
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

systemAuditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
systemAuditEventSchema.index({ actor: 1, createdAt: -1 });
systemAuditEventSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('SystemAuditEvent', systemAuditEventSchema);
