#!/usr/bin/env node
/**
 * Mark unread notifications that reference courses the user no longer participates in.
 *
 * Usage:
 *   node scripts/ops/reconcile-notification-visibility.js
 *   node scripts/ops/reconcile-notification-visibility.js --apply
 *   node scripts/ops/reconcile-notification-visibility.js --userId=<mongoId> --apply
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const {
  reconcileStaleNotifications,
} = require('../../services/notification/notificationVisibility.service');

dotenv.config();

async function main() {
  const apply = process.argv.includes('--apply');
  const userArg = process.argv.find((arg) => arg.startsWith('--userId='));
  const userId = userArg ? userArg.split('=')[1] : null;
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 500;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const report = await reconcileStaleNotifications({
    apply,
    userId: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
    limit,
  });

  console.log(
    JSON.stringify(
      {
        apply,
        staleCount: report.stale.length,
        sample: report.stale.slice(0, 20),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
