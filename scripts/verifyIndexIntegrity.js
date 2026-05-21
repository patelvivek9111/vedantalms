#!/usr/bin/env node
/**
 * U18.2 — Verify FileAsset, Thread, and core institutional indexes.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const SPECS = [
  { model: require('../models/fileAsset.model'), indexes: [{ courseId: 1, createdAt: -1 }] },
  { model: require('../models/asyncJob.model'), indexes: [{ status: 1, createdAt: -1 }] },
  { model: require('../models/systemAuditEvent.model'), indexes: [{ action: 1, createdAt: -1 }] },
  { model: require('../models/thread.model'), indexes: [{ course: 1, lastActivity: -1 }] },
];

function sig(keys) {
  return JSON.stringify(keys);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  let missing = 0;
  for (const { model, indexes } of SPECS) {
    const coll = model.collection.name;
    const existing = await mongoose.connection.db.collection(coll).indexes();
    for (const keys of indexes) {
      const want = sig(keys);
      if (!existing.some((idx) => sig(idx.key) === want)) {
        console.error(`[index-integrity] ${coll} missing ${want}`);
        missing += 1;
      }
    }
  }
  await mongoose.disconnect();
  if (missing) process.exit(1);
  console.log('[index-integrity] OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
