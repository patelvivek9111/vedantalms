const mongoose = require('mongoose');

/**
 * Audit log for one-off data migrations (Wave F).
 */
const migrationRunSchema = new mongoose.Schema(
  {
    migrationId: { type: String, required: true, unique: true },
    description: String,
    dryRun: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'skipped'],
      required: true,
    },
    stats: { type: mongoose.Schema.Types.Mixed },
    error: String,
    host: String,
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true }
);

migrationRunSchema.index({ migrationId: 1 });
migrationRunSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('MigrationRun', migrationRunSchema);
