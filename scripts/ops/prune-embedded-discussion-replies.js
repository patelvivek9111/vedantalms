#!/usr/bin/env node
/**
 * Clears legacy embedded Thread.replies after collection parity is certified.
 * Prerequisites: npm run verify:discussion-final-migration -- --strict (or pass --force after review).
 */
require('dotenv').config();
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const { parseRepairArgv, finishReport } = require('../lib/discussionRepairCli');
const Thread = require('../../models/thread.model');

const { apply, strict } = parseRepairArgv();
const force = process.argv.includes('--force');
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

function runClosureStrict() {
  return spawnSync(process.execPath, ['scripts/verify-discussion-final-migration-state.js', '--strict'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
}

async function main() {
  if (!force) {
    const closure = runClosureStrict();
    if (closure.status !== 0) {
      console.error(
        JSON.stringify(
          {
            error: 'final_migration_verification_failed',
            stderr: closure.stderr,
            stdout: closure.stdout,
            hint: 'Fix integrity issues or pass --force only after manual risk acceptance.',
          },
          null,
          2
        )
      );
      process.exit(1);
    }
  }

  await mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || 'lms' });
  const filter = { deletedAt: null, 'replies.0': { $exists: true } };
  const count = await Thread.countDocuments(filter);
  let pruned = 0;
  if (apply) {
    const res = await Thread.updateMany(filter, { $set: { replies: [] } });
    pruned = res.modifiedCount ?? 0;
  }

  const report = finishReport(
    {
      script: 'prune-embedded-discussion-replies',
      apply,
      force,
      threadsWithEmbeddedArrays: count,
      threadsPruned: apply ? pruned : 0,
    },
    ['embeddedPrune', 'general']
  );

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (strict && count && !apply) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
