const { reconcileStaleNotifications } = require('./notification/notificationVisibility.service');
const ConversationParticipant = require('../models/ConversationParticipant');
const { recomputeParticipantUnread } = require('./inboxUnread.service');

async function repairInboxUnreadState({ apply = false, limit = 5000 } = {}) {
  const cursor = ConversationParticipant.find({}).limit(limit).cursor();
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

  return { scanned, changed, apply };
}

async function reconcileNotificationVisibility({ apply = false, limit = 500 } = {}) {
  return reconcileStaleNotifications({ apply, limit });
}

async function runNightlyOpsBundle({ apply = false } = {}) {
  const startedAt = new Date().toISOString();
  const [inbox, notifications] = await Promise.all([
    repairInboxUnreadState({ apply, limit: parseInt(process.env.NIGHTLY_INBOX_REPAIR_LIMIT || '5000', 10) }),
    reconcileNotificationVisibility({
      apply,
      limit: parseInt(process.env.NIGHTLY_NOTIFICATION_RECONCILE_LIMIT || '500', 10),
    }),
  ]);

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    apply,
    inbox,
    notifications: {
      staleCount: notifications.stale?.length || 0,
      sample: (notifications.stale || []).slice(0, 10),
    },
  };
}

module.exports = {
  repairInboxUnreadState,
  reconcileNotificationVisibility,
  runNightlyOpsBundle,
};
