const mongoose = require('mongoose');

const migrationMetadataSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    checksum: { type: String, required: true },
    appliedAt: Date,
    durationMs: Number,
    rollbackAvailable: { type: Boolean, default: false },
    dryRun: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['previewed', 'applied', 'rolled_back', 'failed'],
      default: 'previewed',
      index: true,
    },
    rowCounts: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    mismatchReport: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MigrationMetadata', migrationMetadataSchema);
