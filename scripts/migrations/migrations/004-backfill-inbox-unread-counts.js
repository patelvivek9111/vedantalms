/**
 * Backfill ConversationParticipant.unreadCount and lastReadMessageId from message history.
 */
const ConversationParticipant = require('../../../models/ConversationParticipant');
const { recomputeParticipantUnread } = require('../../../services/inboxUnread.service');

module.exports = {
  id: '004-backfill-inbox-unread-counts',
  description: 'Backfill denormalized inbox unreadCount on conversation participants',
  async up({ dryRun, log, addStats }) {
    const cursor = ConversationParticipant.find({}).cursor();
    let updated = 0;
    let scanned = 0;

    for await (const row of cursor) {
      scanned += 1;
      const patch = await recomputeParticipantUnread(row);
      if (!dryRun) {
        await ConversationParticipant.updateOne({ _id: row._id }, { $set: patch });
      }
      updated += 1;
    }

    addStats({ scanned, updated, dryRun });
    log(`Backfilled unread state for ${updated} participant rows (scanned ${scanned})`);
  },
};
