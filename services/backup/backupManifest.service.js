const {
  RESTORE_COMPATIBILITY_VERSION,
  EXPORT_MANIFEST_VERSION,
  validateExportManifest,
} = require('../../shared/portability/exportManifest.cjs');

/**
 * Register or update backup manifest index entry after export.
 */
async function registerBackupManifest({ backupId, batchId, manifest, archiveLocation }) {
  try {
    const InstitutionBackupManifest = require('../../models/institutionBackupManifest.model');
    const record = await InstitutionBackupManifest.findOneAndUpdate(
      { backupId },
      {
        backupId,
        batchId,
        institutionId: manifest.institutionId,
        schemaVersion: manifest.schemaVersion,
        schemaVersions: manifest.schemaVersions,
        exportSections: (manifest.sections || []).map((s) => ({
          name: s.name,
          files: s.files || [s.file].filter(Boolean),
          recordCount: s.recordCount,
          contentHash: s.contentHash,
          schemaVersion: s.schemaVersion,
        })),
        manifestChecksum: manifest.checksum,
        archiveLocation,
        restoreCompatibilityVersion: manifest.restoreCompatibilityVersion || RESTORE_COMPATIBILITY_VERSION,
        exportVersion: manifest.exportVersion,
        integrityVerificationStatus: 'pending',
      },
      { upsert: true, new: true }
    );
    return record;
  } catch (err) {
    if (err.name === 'MongoNotConnectedError' || err.message?.includes('buffering timed out')) {
      return null;
    }
    throw err;
  }
}

/**
 * Verify a backup bundle can be restored by this application version.
 */
function verifyBackupCompatibility(manifestOrBackupId, options = {}) {
  const issues = [];
  let manifest = manifestOrBackupId;

  if (typeof manifestOrBackupId === 'string') {
    return {
      compatible: false,
      issues: ['pass manifest object or use verifyBackupCompatibilityAsync for backupId lookup'],
    };
  }

  const validation = validateExportManifest(manifest);
  if (!validation.valid) issues.push(...validation.errors);

  const restoreVer = manifest.restoreCompatibilityVersion || RESTORE_COMPATIBILITY_VERSION;
  if (restoreVer !== RESTORE_COMPATIBILITY_VERSION) {
    issues.push(
      `restoreCompatibilityVersion ${restoreVer} does not match application ${RESTORE_COMPATIBILITY_VERSION}`
    );
  }

  if (manifest.exportVersion && manifest.exportVersion !== EXPORT_MANIFEST_VERSION) {
    if (options.strict) {
      issues.push(`export manifest version ${manifest.exportVersion} not supported in strict mode`);
    }
  }

  return {
    compatible: issues.length === 0,
    restoreCompatibilityVersion: restoreVer,
    applicationVersion: RESTORE_COMPATIBILITY_VERSION,
    issues,
  };
}

async function verifyBackupCompatibilityAsync(backupId) {
  const InstitutionBackupManifest = require('../../models/institutionBackupManifest.model');
  const record = await InstitutionBackupManifest.findOne({ backupId }).lean();
  if (!record) {
    return { compatible: false, issues: [`backup not found: ${backupId}`] };
  }

  const manifest = {
    exportVersion: record.exportVersion,
    restoreCompatibilityVersion: record.restoreCompatibilityVersion,
    checksum: record.manifestChecksum,
    generatedAt: record.createdAt?.toISOString?.() || record.createdAt,
    sections: record.exportSections,
    schemaVersion: record.schemaVersion,
    schemaVersions: record.schemaVersions,
  };

  const result = verifyBackupCompatibility(manifest);
  return { ...result, backupId, archiveLocation: record.archiveLocation };
}

async function markBackupVerified(backupId, { ok, issues = [] }) {
  const InstitutionBackupManifest = require('../../models/institutionBackupManifest.model');
  return InstitutionBackupManifest.findOneAndUpdate(
    { backupId },
    {
      integrityVerificationStatus: ok ? 'verified' : 'failed',
      integrityVerifiedAt: new Date(),
      integrityIssues: issues,
    },
    { new: true }
  );
}

module.exports = {
  registerBackupManifest,
  verifyBackupCompatibility,
  verifyBackupCompatibilityAsync,
  markBackupVerified,
};
