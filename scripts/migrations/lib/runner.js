const os = require('os');
const MigrationRun = require('../../../models/migrationRun.model');

/**
 * @typedef {object} MigrationContext
 * @property {boolean} dryRun
 * @property {import('mongoose')} mongoose
 * @property {(msg: string, data?: object) => void} log
 * @property {(patch: object) => void} addStats
 */

/**
 * @typedef {object} MigrationDef
 * @property {string} id
 * @property {string} description
 * @property {(ctx: MigrationContext) => Promise<object>} up
 */

async function wasCompleted(migrationId) {
  const doc = await MigrationRun.findOne({ migrationId, status: 'completed', dryRun: false }).lean();
  return Boolean(doc);
}

async function runMigration(def, { dryRun = false, force = false } = {}) {
  if (!force && !dryRun && (await wasCompleted(def.id))) {
    return { migrationId: def.id, status: 'skipped', reason: 'already_completed' };
  }

  const stats = {};
  const log = (msg, data) => {
    if (data) console.log(`[migrate:${def.id}] ${msg}`, data);
    else console.log(`[migrate:${def.id}] ${msg}`);
  };
  const addStats = (patch) => Object.assign(stats, patch);

  const runDoc = await MigrationRun.create({
    migrationId: def.id,
    description: def.description,
    dryRun,
    status: 'running',
    host: os.hostname(),
    stats: {},
  });

  try {
    log(dryRun ? 'DRY RUN' : 'APPLY', { description: def.description });
    const result = await def.up({ dryRun, mongoose: require('mongoose'), log, addStats });
    Object.assign(stats, result || {});

    runDoc.status = 'completed';
    runDoc.stats = stats;
    runDoc.completedAt = new Date();
    if (!dryRun) await runDoc.save();
    else await MigrationRun.deleteOne({ _id: runDoc._id });

    return { migrationId: def.id, status: 'completed', dryRun, stats };
  } catch (error) {
    runDoc.status = 'failed';
    runDoc.error = error.message || String(error);
    runDoc.stats = stats;
    runDoc.completedAt = new Date();
    await runDoc.save();
    throw error;
  }
}

async function runAll(migrations, options = {}) {
  const results = [];
  for (const def of migrations) {
    if (options.only && def.id !== options.only && !def.id.startsWith(options.only)) {
      continue;
    }
    results.push(await runMigration(def, options));
  }
  return results;
}

module.exports = {
  runMigration,
  runAll,
  wasCompleted,
};
