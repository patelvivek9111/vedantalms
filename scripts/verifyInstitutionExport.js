#!/usr/bin/env node
/**
 * Validate institutional export manifest + section files (Phase R1/R3).
 * Usage: node scripts/verifyInstitutionExport.js path/to/export/batchId
 */
const fs = require('fs');
const path = require('path');
const {
  validateExportManifest,
  verifySectionHashes,
} = require('../shared/portability/exportManifest.cjs');
const { hashContent } = require('../shared/portability/exportUtils.cjs');

function main() {
  const exportDir = process.argv[2];
  if (!exportDir) {
    console.error('Usage: node scripts/verifyInstitutionExport.js <export-directory>');
    process.exit(1);
  }

  const manifestPath = path.join(exportDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('manifest.json not found');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const validation = validateExportManifest(manifest);
  const issues = [...validation.errors];
  const hashByFile = {};

  for (const section of manifest.sections || []) {
    const files = section.files || [section.file].filter(Boolean);
    for (const file of files) {
      const filePath = path.join(exportDir, file);
      if (!fs.existsSync(filePath)) {
        issues.push(`missing section file: ${file}`);
      } else {
        hashByFile[file] = hashContent(fs.readFileSync(filePath, 'utf8'));
      }
    }
  }

  const hashCheck = verifySectionHashes(manifest, hashByFile);
  issues.push(...hashCheck.issues);

  console.log(
    JSON.stringify(
      {
        ok: issues.length === 0,
        exportDir,
        exportVersion: manifest.exportVersion,
        sectionCount: manifest.sections?.length || 0,
        checksum: manifest.checksum,
        issues,
      },
      null,
      2
    )
  );
  process.exit(issues.length === 0 ? 0 : 1);
}

main();
