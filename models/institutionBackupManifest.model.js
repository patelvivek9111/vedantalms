const mongoose = require('mongoose');
const { RESTORE_COMPATIBILITY_VERSION } = require('../shared/portability/exportManifest.cjs');

/**
 * Index of institution backup bundles for audit, restore planning, and DR (Phase R4).
 */
const institutionBackupManifestSchema = new mongoose.Schema(
  {
    backupId: { type: String, required: true, unique: true, index: true },
    batchId: { type: String, required: true },
    institutionId: { type: String, default: 'default' },
    createdAt: { type: Date, default: Date.now, index: true },
    schemaVersion: { type: Number, required: true },
    schemaVersions: { type: mongoose.Schema.Types.Mixed, default: {} },
    exportSections: [
      {
        name: String,
        files: [String],
        recordCount: Number,
        contentHash: String,
        schemaVersion: Number,
      },
    ],
    manifestChecksum: { type: String, required: true },
    archiveLocation: { type: String, required: true },
    integrityVerificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending',
    },
    integrityVerifiedAt: Date,
    integrityIssues: [String],
    restoreCompatibilityVersion: {
      type: String,
      default: RESTORE_COMPATIBILITY_VERSION,
    },
    exportVersion: { type: String },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('InstitutionBackupManifest', institutionBackupManifestSchema);
