#!/usr/bin/env node
/**
 * Reconcile denormalized inbox unread counts.
 *
 * Usage:
 *   node scripts/ops/repair-inbox-unread-state.js
 *   node scripts/ops/repair-inbox-unread-state.js --apply
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ConversationParticipant = require('../../models/ConversationParticipant');
const { recomputeParticipantUnread } = require('../../services/inboxUnread.service');

dotenv.config();

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const cursor = ConversationParticipant.find({}).cursor();
  let scanned = 0;
  let changed = 0;

  for await (const row of cursor) {
    scanned += 1;
    const patch = await recomputeParticipantUnread(row);
    const current = row.unreadCount || 0;
    const drift =
      current !== patch.unreadCount ||
      String(row.lastReadMessageId || '') !== String(patch.lastReadMessageId || '');

    if (drift) {
      changed += 1;
      if (apply) {
        await ConversationParticipant.updateOne({ _id: row._id }, { $set: patch });
      }
    }
  }

  console.log(
    `[repair-inbox-unread] scanned=${scanned} drift=${changed} apply=${apply}`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
