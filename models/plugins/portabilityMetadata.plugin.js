const { SCHEMA_VERSION } = require('../../shared/portability/schemaMetadata.cjs');

/**
 * Adds optional portability metadata without changing existing document shape requirements.
 */
function portabilityMetadataPlugin(schema) {
  if (!schema.path('schemaVersion')) {
    schema.add({
      schemaVersion: { type: Number, default: SCHEMA_VERSION },
    });
  }
  if (!schema.path('migrationMeta')) {
    schema.add({
      migrationMeta: {
        migratedFrom: String,
        importedBy: String,
        sourceSystem: String,
        importBatchId: String,
      },
    });
  }
}

module.exports = { portabilityMetadataPlugin };
