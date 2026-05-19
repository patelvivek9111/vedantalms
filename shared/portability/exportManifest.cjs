const crypto = require('crypto');

const EXPORT_MANIFEST_VERSION = '2.0.0';
const LEGACY_EXPORT_MANIFEST_VERSION = '1.0.0';
const RESTORE_COMPATIBILITY_VERSION = '2.0.0';

/**
 * @param {object} params
 * @returns {object} Institutional export manifest (Phase R1/R4).
 */
function buildExportManifest({
  institutionId = 'default',
  exportType = 'institution',
  schemaVersion = 1,
  schemaVersions = {},
  sections = [],
  exportSourceVersion,
  notes,
  backupId,
  checkpointPath,
}) {
  const generatedAt = new Date().toISOString();
  const payload = {
    exportVersion: EXPORT_MANIFEST_VERSION,
    schemaVersion,
    restoreCompatibilityVersion: RESTORE_COMPATIBILITY_VERSION,
    generatedAt,
    institutionId,
    exportType,
    schemaVersions,
    sections,
    exportSourceVersion: exportSourceVersion || process.env.npm_package_version || '1.0.0',
    notes: notes || null,
    backupId: backupId || null,
    checkpointPath: checkpointPath || 'checkpoint.json',
  };
  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
  return { ...payload, checksum };
}

function validateExportManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest must be an object'] };
  }
  const version = manifest.exportVersion;
  if (version !== EXPORT_MANIFEST_VERSION && version !== LEGACY_EXPORT_MANIFEST_VERSION) {
    errors.push(`unsupported exportVersion: ${version}`);
  }
  if (!manifest.generatedAt) errors.push('generatedAt required');
  if (!manifest.checksum) errors.push('checksum required');
  if (!Array.isArray(manifest.sections)) errors.push('sections must be an array');

  if (errors.length === 0) {
    const { checksum, ...rest } = manifest;
    const expected = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
    if (checksum !== expected) errors.push('checksum mismatch');
  }

  for (const section of manifest.sections || []) {
    if (version === EXPORT_MANIFEST_VERSION) {
      if (!section.contentHash && !section.checksum) {
        errors.push(`section ${section.name}: contentHash required for v2 manifests`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function verifySectionHashes(manifest, sectionHashByFile) {
  const issues = [];
  for (const section of manifest.sections || []) {
    const expected = section.contentHash || section.checksum;
    if (!expected) continue;
    const files = section.files || [section.file].filter(Boolean);
    for (const file of files) {
      const actual = sectionHashByFile[file];
      if (!actual) {
        issues.push(`missing hash for file: ${file}`);
      } else if (actual !== expected && files.length === 1) {
        issues.push(`hash mismatch for ${section.name}/${file}`);
      }
    }
    if (files.length > 1) {
      const combined = crypto
        .createHash('sha256')
        .update(files.map((f) => sectionHashByFile[f] || '').join(''))
        .digest('hex');
      const expectedAggregate = section.aggregateHash || section.contentHash;
      if (expectedAggregate && combined !== expectedAggregate) {
        issues.push(`aggregate hash mismatch for section ${section.name}`);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

module.exports = {
  EXPORT_MANIFEST_VERSION,
  LEGACY_EXPORT_MANIFEST_VERSION,
  RESTORE_COMPATIBILITY_VERSION,
  buildExportManifest,
  validateExportManifest,
  verifySectionHashes,
};
