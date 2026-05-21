#!/usr/bin/env node
/**
 * U34F — file platform scale bench (metadata listing + optional upload simulation).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const FileAsset = require('../../models/fileAsset.model');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const listLimit = parseInt(process.env.FILE_SCALE_LIST || '10000', 10);
  const started = Date.now();
  let cursor = null;
  let count = 0;
  while (count < listLimit) {
    const q = cursor ? { _id: { $lt: cursor } } : {};
    const batch = await FileAsset.find(q).sort({ _id: -1 }).limit(500).select('_id size category').lean();
    if (!batch.length) break;
    cursor = batch[batch.length - 1]._id;
    count += batch.length;
  }
  const ms = Date.now() - started;
  console.log(JSON.stringify({ listed: count, ms, ratePerSec: Number((count / (ms / 1000)).toFixed(2)) }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
