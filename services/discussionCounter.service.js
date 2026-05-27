const Thread = require('../models/thread.model');
const DiscussionReply = require('../models/discussionReply.model');

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

async function recomputeCounters(threadId) {
  const [replyCount, participants, likeAgg, unresolvedModerationCount, lastReply] = await Promise.all([
    DiscussionReply.countDocuments({ threadId, deletedAt: null }),
    DiscussionReply.distinct('authorId', { threadId, deletedAt: null }),
    DiscussionReply.aggregate([
      { $match: { threadId: typeof threadId === 'string' ? require('mongoose').Types.ObjectId.createFromHexString(threadId) : threadId, deletedAt: null } },
      { $group: { _id: null, likes: { $sum: '$likeCount' } } },
    ]).catch(() => []),
    DiscussionReply.countDocuments({ threadId, 'moderation.hidden': true, deletedAt: null }),
    DiscussionReply.findOne({ threadId, deletedAt: null }).sort({ createdAt: -1 }).select('createdAt').lean(),
  ]);

  const counters = {
    replyCount,
    participantCount: participants.length,
    unreadCount: 0,
    likeCount: likeAgg[0]?.likes || 0,
    unresolvedModerationCount,
  };

  await Thread.findByIdAndUpdate(threadId, {
    counters,
    ...(lastReply ? { lastActivity: lastReply.createdAt } : {}),
  });
  return counters;
}

async function incrementReplyCreated(threadId, authorId, { parentReplyId = null, createdAt = new Date() } = {}) {
  const existingByAuthor = await DiscussionReply.countDocuments({
    threadId,
    authorId,
    deletedAt: null,
  });
  const update = {
    $inc: {
      'counters.replyCount': 1,
      ...(existingByAuthor <= 1 ? { 'counters.participantCount': 1 } : {}),
    },
    $set: { lastActivity: createdAt },
  };
  await Thread.findByIdAndUpdate(threadId, update);
  if (parentReplyId) {
    await DiscussionReply.findByIdAndUpdate(parentReplyId, {
      $inc: { childCount: 1 },
      $set: { latestChildReplyAt: createdAt },
    });
  }
}

async function incrementReplyDeleted(threadId, authorId, { parentReplyId = null } = {}) {
  const remainingByAuthor = await DiscussionReply.countDocuments({
    threadId,
    authorId,
    deletedAt: null,
  });
  await Thread.findByIdAndUpdate(threadId, {
    $inc: {
      'counters.replyCount': -1,
      ...(remainingByAuthor === 0 ? { 'counters.participantCount': -1 } : {}),
    },
  });
  if (parentReplyId) {
    await DiscussionReply.findByIdAndUpdate(parentReplyId, { $inc: { childCount: -1 } });
  }
}

async function updateLikeCount(threadId, replyId, delta) {
  await Thread.findByIdAndUpdate(threadId, { $inc: { 'counters.likeCount': delta } });
}

async function syncThreadCountersFromLegacy(thread) {
  if (!thread?._id) return null;
  const legacyReplies = Array.isArray(thread.replies) ? thread.replies : [];
  const active = legacyReplies.filter((reply) => !reply.deletedAt);
  const participants = new Set(active.map((reply) => normalizeId(reply.author)).filter(Boolean));
  const likeCount = active.reduce((sum, reply) => sum + (Array.isArray(reply.likes) ? reply.likes.length : 0), 0);
  const counters = {
    replyCount: active.length,
    participantCount: participants.size,
    unreadCount: thread.counters?.unreadCount || 0,
    likeCount,
    unresolvedModerationCount: thread.counters?.unresolvedModerationCount || 0,
  };
  await Thread.findByIdAndUpdate(thread._id, { counters });
  return counters;
}

module.exports = {
  incrementReplyCreated,
  incrementReplyDeleted,
  recomputeCounters,
  syncThreadCountersFromLegacy,
  updateLikeCount,
};
