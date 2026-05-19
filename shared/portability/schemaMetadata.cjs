/** Current document schema version for portability metadata (Phase P2). */
const SCHEMA_VERSION = 1;

const MIGRATION_META_FIELDS = {
  migratedFrom: { type: String },
  importedBy: { type: String },
  sourceSystem: { type: String },
  importBatchId: { type: String },
};

module.exports = {
  SCHEMA_VERSION,
  MIGRATION_META_FIELDS,
};
