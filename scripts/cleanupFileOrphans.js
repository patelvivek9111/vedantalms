#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { runOrphanCleanup } = require('../services/fileCleanup.service');

const apply = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms');
  const result = await runOrphanCleanup({ dryRun: !apply });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
