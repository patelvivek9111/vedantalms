#!/usr/bin/env node
/**
 * Scheduled file maintenance — run via cron: node workers/fileMaintenanceWorker.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { enqueueJob } = require('../services/jobQueue.service');
const User = require('../models/user.model');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms');
  const admin = await User.findOne({ role: 'admin' }).lean();
  if (!admin) {
    console.error('No admin user for maintenance job');
    process.exit(1);
  }
  const { job, async: isAsync } = await enqueueJob(
    'maintenance.files',
    { dryRun: process.env.MAINTENANCE_DRY_RUN !== 'false' },
    admin
  );
  console.log('Maintenance job', job._id, isAsync ? '(queued)' : '(inline)');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
