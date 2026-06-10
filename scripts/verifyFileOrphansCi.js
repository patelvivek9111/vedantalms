#!/usr/bin/env node
/**
 * P3-1 CI gate: fail when orphan counts exceed configured thresholds.
 * Usage: node scripts/verifyFileOrphansCi.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runOrphanVerification } = require('../services/fileCleanup.service');

function readThreshold(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return fallback;
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('verify:file-orphans:ci SKIP — MONGODB_URI not configured');
    process.exit(0);
  }

  const maxUnattachedStaged = readThreshold('CI_MAX_UNATTACHED_STAGED', 500);
  const maxMissingBlobs = readThreshold('CI_MAX_MISSING_BLOBS', 50);
  const maxProtectedOrphans = readThreshold('CI_MAX_PROTECTED_ORPHANS', 200);

  await mongoose.connect(uri);
  const { report } = await runOrphanVerification({ limit: 1000 });
  await mongoose.disconnect();

  const summary = report.summary || {};
  const violations = [];

  if ((summary.unattachedStaged || 0) > maxUnattachedStaged) {
    violations.push(
      `unattachedStaged ${summary.unattachedStaged} > ${maxUnattachedStaged}`
    );
  }
  if ((summary.missingBlobs || 0) > maxMissingBlobs) {
    violations.push(`missingBlobs ${summary.missingBlobs} > ${maxMissingBlobs}`);
  }
  if ((summary.protectedOrphans || 0) > maxProtectedOrphans) {
    violations.push(
      `protectedOrphans ${summary.protectedOrphans} > ${maxProtectedOrphans}`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: violations.length === 0,
        thresholds: { maxUnattachedStaged, maxMissingBlobs, maxProtectedOrphans },
        summary,
        violations,
      },
      null,
      2
    )
  );

  if (violations.length) {
    console.error('verify:file-orphans:ci FAILED');
    process.exit(1);
  }

  console.log('verify:file-orphans:ci OK');
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
