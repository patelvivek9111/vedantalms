const path = require('path');
const { getStorageService } = require('../storage');
const { buildExportManifest } = require('../../shared/portability/exportManifest.cjs');
const { SCHEMA_VERSION } = require('../../shared/portability/schemaMetadata.cjs');
const {
  SECTION_DEFINITIONS,
  DEFAULT_CHUNK_SIZE,
  resolveSectionNames,
} = require('../../shared/portability/sectionRegistry.cjs');
const { markSectionComplete, isSectionComplete, readCheckpoint } = require('../../shared/portability/checkpoint.cjs');
const fs = require('fs');
const { hashContent } = require('../../shared/portability/exportUtils.cjs');
const { writeSectionChunks } = require('./chunkedWriter');
const { registerBackupManifest } = require('../backup/backupManifest.service');
const { buildBlobManifestForExport } = require('./blobManifest.service');

/**
 * Build institution-level portable export package (JSON sections + manifest).
 * Supports partial sections, resumable checkpoints, and chunked output.
 */
async function exportInstitutionBundle(options = {}) {
  const storage = getStorageService();
  const exportRoot = storage.institutionExports;
  const batchId = options.batchId || `export-${Date.now()}`;
  const resume = options.resume !== false;
  await exportRoot.ensureDir(batchId);

  const checkpointRel = path.join(batchId, 'checkpoint.json');
  const checkpointPath = exportRoot.resolvePath(checkpointRel);

  const sectionNames = resolveSectionNames(options.sections);
  const sections = [];
  const schemaVersions = { default: SCHEMA_VERSION };
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;

  for (const name of sectionNames) {
    if (resume && isSectionComplete(checkpointPath, name)) {
      const cp = readCheckpoint(checkpointPath);
      const chunkFiles = cp.sectionChunks?.[name] || [`${name}.json`];
      const hashes = chunkFiles.map((file) => {
        const full = exportRoot.resolvePath(path.join(batchId, file));
        return fs.existsSync(full) ? hashContent(fs.readFileSync(full, 'utf8')) : null;
      });
      const contentHash =
        hashes.length === 1 ? hashes[0] : hashContent(hashes.filter(Boolean).join(''));
      sections.push({
        name,
        files: chunkFiles,
        file: chunkFiles[0],
        recordCount: 0,
        contentHash,
        resumed: true,
        schemaVersion: SECTION_DEFINITIONS[name]?.schemaVersion ?? SCHEMA_VERSION,
      });
      continue;
    }

    const def = SECTION_DEFINITIONS[name];
    if (!def) continue;

    schemaVersions[name] = def.schemaVersion ?? SCHEMA_VERSION;
    let sectionMeta;

    if (def.cursor) {
      const batches = [];
      for await (const batch of def.cursor(chunkSize)) {
        if (batch.length) batches.push(batch);
      }
      sectionMeta = await writeSectionChunks(exportRoot, batchId, name, batches.length ? batches : [[]], {
        fromCursor: true,
      });
    } else if (def.export) {
      const data = await def.export();
      const isNested = data && !Array.isArray(data);
      sectionMeta = await writeSectionChunks(exportRoot, batchId, name, data, { nested: isNested });
    } else {
      continue;
    }

    sectionMeta.schemaVersion = schemaVersions[name];
    sections.push(sectionMeta);
    markSectionComplete(checkpointPath, name, sectionMeta.files || [sectionMeta.file]);
  }

  let blobManifest = null;
  if (options.includeBlobManifest !== false) {
    blobManifest = await buildBlobManifestForExport(exportRoot, batchId, {
      includeBinaries: options.includeBinaries === true,
    });
  }

  const manifest = buildExportManifest({
    institutionId: options.institutionId || 'default',
    exportType: 'institution',
    schemaVersion: SCHEMA_VERSION,
    schemaVersions,
    sections,
    notes: options.notes,
    backupId: options.backupId || batchId,
    checkpointPath: 'checkpoint.json',
  });

  if (blobManifest) {
    manifest.blobManifest = {
      path: 'blob-manifest.json',
      includedCount: blobManifest.includedCount,
      missingCount: blobManifest.missingCount,
      includeBinaries: blobManifest.includeBinaries,
      manifestHash: blobManifest.manifestHash,
    };
    const crypto = require('crypto');
    const { checksum, ...rest } = manifest;
    manifest.checksum = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
  }

  await exportRoot.writeFile(path.join(batchId, 'manifest.json'), manifest);

  let backupRecord = null;
  if (options.registerBackup !== false) {
    backupRecord = await registerBackupManifest({
      backupId: options.backupId || batchId,
      batchId,
      manifest,
      archiveLocation: exportRoot.resolvePath(batchId),
    });
  }

  return {
    batchId,
    directory: exportRoot.resolvePath(batchId),
    manifest,
    sections,
    backupRecord,
    blobManifest,
  };
}

module.exports = {
  exportInstitutionBundle,
  SECTION_DEFINITIONS,
};
