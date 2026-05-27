const crypto = require('crypto');
const MigrationMetadata = require('../models/migrationMetadata.model');

function checksumFor(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

async function recordMigrationRun(name, summary, { apply = false, rollbackAvailable = false, status } = {}) {
  const checksum = checksumFor(summary);
  const payload = {
    name,
    checksum,
    appliedAt: apply ? new Date() : null,
    durationMs: summary.durationMs || 0,
    rollbackAvailable,
    dryRun: !apply,
    status: status || (apply ? 'applied' : 'previewed'),
    rowCounts: summary.rowCounts || {},
    mismatchReport: summary.mismatchReport || {},
  };

  return MigrationMetadata.findOneAndUpdate(
    { name },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = {
  checksumFor,
  recordMigrationRun,
};
