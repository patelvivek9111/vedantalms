#!/usr/bin/env node
/**
 * Validate Notification collection indexes match expected read/unread/TTL patterns.
 *
 * Usage:
 *   node scripts/ops/validate-notification-indexes.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Notification = require('../../models/notification.model');

dotenv.config();

const REQUIRED_INDEX_KEYS = [
  { user: 1, read: 1, createdAt: -1 },
  { user: 1, type: 1, createdAt: -1 },
  { expiresAt: 1 },
];

function indexKeySignature(index) {
  const key = index.key || index;
  return JSON.stringify(key);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  await Notification.syncIndexes();
  const indexes = await Notification.collection.indexes();

  const signatures = new Set(indexes.map(indexKeySignature));
  const missing = REQUIRED_INDEX_KEYS.filter(
    (key) => !signatures.has(JSON.stringify(key))
  );

  const report = {
    collection: Notification.collection.collectionName,
    indexCount: indexes.length,
    indexes: indexes.map((idx) => ({
      name: idx.name,
      key: idx.key,
      unique: Boolean(idx.unique),
      partialFilterExpression: idx.partialFilterExpression || null,
    })),
    missingRequired: missing,
    ok: missing.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(report.ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
