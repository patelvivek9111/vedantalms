#!/usr/bin/env node
/**
 * Wave F migration CLI.
 *
 * Usage:
 *   node scripts/migrations/run.js --dry-run
 *   node scripts/migrations/run.js --only=001
 *   node scripts/migrations/run.js --force
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const migrations = require('./registry');
const { runAll } = require('./lib/runner');

dotenv.config();

function parseArgs(argv) {
  const opts = { dryRun: false, force: false, only: null };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
    else if (arg.startsWith('--only=')) opts.only = arg.slice('--only='.length);
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`
Usage: node scripts/migrations/run.js [options]

  --dry-run       Preview changes without writing (no completion record)
  --only=001      Run migration id prefix match only
  --force         Re-run even if already completed
`);
    process.exit(0);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const connectOptions = {
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10', 10),
  };
  if (process.env.MONGO_DB_NAME) {
    connectOptions.dbName = process.env.MONGO_DB_NAME;
  }
  await mongoose.connect(uri, connectOptions);

  console.log(`[migrate] Connected. dryRun=${opts.dryRun} force=${opts.force}`);
  const results = await runAll(migrations, opts);

  for (const r of results) {
    console.log(`[migrate] ${r.migrationId}: ${r.status}`, r.stats || r.reason || '');
  }

  await mongoose.disconnect();
  console.log('[migrate] Done.');
}

main().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
