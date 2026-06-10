const mongoose = require('mongoose');
const Message = require('../models/Message');
const ConversationParticipant = require('../models/ConversationParticipant');

function isDenormUnreadEnabled() {
  return process.env.INBOX_DENORM_UNREAD === 'true';
}

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

/** ObjectId for queries/aggregations — string ids break $lookup lastReadAt matching. */
function toObjectId(value) {
  const raw = value?._id ?? value;
  if (raw == null) return null;
  if (raw instanceof mongoose.Types.ObjectId) return raw;
  const asString = String(raw);
  if (mongoose.Types.ObjectId.isValid(asString)) {
    return new mongoose.Types.ObjectId(asString);
  }
  return raw;
}

/**
 * Aggregation unread counts (fallback authority when denorm flag is off).
 */
function buildUnreadCountAggregation({ conversationIds, userId, participantCollName }) {
  return Message.aggregate([
    {
      $match: {
        conversationId: { $in: conversationIds },
        senderId: { $ne: userId },
      },
    },
    {
      $lookup: {
        from: participantCollName,
        let: { cid: '$conversationId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$conversationId', '$$cid'] },
                  { $eq: ['$userId', userId] },
                ],
              },
            },
          },
          { $project: { lastReadAt: 1, _id: 0 } },
        ],
        as: 'me',
      },
    },
    {
      $addFields: {
        lastReadAt: { $ifNull: [{ $arrayElemAt: ['$me.lastReadAt', 0] }, new Date(0)] },
      },
    },
    {
      $match: {
        $expr: { $gt: ['$createdAt', '$lastReadAt'] },
      },
    },
    {
      $group: {
        _id: '$conversationId',
        count: { $sum: 1 },
      },
    },
  ]);
}

async function aggregateUnreadByConversation(conversationIds, userId) {
  if (!conversationIds?.length) return new Map();
  const participantColl = ConversationParticipant.collection.collectionName;
  const unreadAgg = await buildUnreadCountAggregation({
    conversationIds,
    userId: toObjectId(userId),
    participantCollName: participantColl,
  });
  return new Map(unreadAgg.map((item) => [String(item._id), item.count]));
}

async function recordMessageSent({ conversationId, senderId, messageId, session = null }) {
  if (!isDenormUnreadEnabled()) return;
  const opts = session ? { session } : undefined;
  const readAt = new Date();
  await ConversationParticipant.updateOne(
    { conversationId, userId: senderId },
    {
      $set: {
        lastReadAt: readAt,
        lastReadMessageId: messageId,
        unreadCount: 0,
      },
    },
    opts
  );
  await ConversationParticipant.updateMany(
    { conversationId, userId: { $ne: senderId } },
    {
      $inc: { unreadCount: 1 },
      $set: { folder: 'inbox' },
    },
    opts
  );
}

async function markConversationRead({ conversationId, userId, session = null }) {
  const opts = session ? { session } : undefined;
  const latestQuery = Message.findOne({ conversationId })
    .sort({ createdAt: -1 })
    .select('_id createdAt');
  if (session) latestQuery.session(session);
  const latest = await latestQuery.lean();

  const update = {
    lastReadAt: new Date(),
    lastReadMessageId: latest?._id || null,
  };
  if (isDenormUnreadEnabled()) {
    update.unreadCount = 0;
  }

  await ConversationParticipant.updateOne(
    { conversationId, userId },
    { $set: update },
    opts
  );
  return latest;
}

/**
 * Sidebar badge total: unread messages in the Inbox folder only (excludes sent/archived/deleted).
 */
async function getInboxUnreadTotal(userId) {
  const uid = toObjectId(userId);
  const participantRows = await ConversationParticipant.find({
    userId: uid,
    folder: 'inbox',
  })
    .select('conversationId unreadCount folder')
    .lean();

  if (!participantRows.length) return 0;

  const conversationIds = participantRows.map((r) => r.conversationId);
  const receivedConversationIds = await Message.distinct('conversationId', {
    conversationId: { $in: conversationIds },
    senderId: { $ne: uid },
  });
  const receivedSet = new Set(receivedConversationIds.map(String));

  // Always derive badge totals from message history + lastReadAt so denorm drift cannot inflate counts.
  const unreadMap = await aggregateUnreadByConversation(conversationIds, uid);
  return participantRows.reduce((sum, row) => {
    const key = String(row.conversationId);
    if (!receivedSet.has(key)) return sum;
    return sum + (unreadMap.get(key) || 0);
  }, 0);
}

/**
 * Recompute denormalized unread for one participant row (repair / migration).
 */
async function recomputeParticipantUnread(participantRow) {
  const { conversationId, userId, lastReadAt } = participantRow;
  const unreadCount = await Message.countDocuments({
    conversationId,
    senderId: { $ne: userId },
    createdAt: { $gt: lastReadAt || new Date(0) },
  });
  const latest = await Message.findOne({ conversationId })
    .sort({ createdAt: -1 })
    .select('_id')
    .lean();

  return {
    unreadCount: Math.max(0, unreadCount),
    lastReadMessageId: latest?._id || null,
  };
}

module.exports = {
  isDenormUnreadEnabled,
  toObjectId,
  buildUnreadCountAggregation,
  aggregateUnreadByConversation,
  recordMessageSent,
  markConversationRead,
  getInboxUnreadTotal,
  recomputeParticipantUnread,
};
