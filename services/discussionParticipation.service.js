const DiscussionParticipation = require('../models/discussionParticipation.model');
const DiscussionReply = require('../models/discussionReply.model');

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function isInstructorLike(user) {
  return ['teacher', 'teaching_assistant', 'admin'].includes(user?.role);
}

async function recordReplyCreated({ thread, reply, user, isRoot = true }) {
  if (!thread?._id || !user?._id || !reply?._id) return null;
  const createdAt = reply.createdAt || new Date();
  const threadId = thread._id;
  const userId = user._id;
  const instructorReply = isInstructorLike(user);

  await DiscussionParticipation.updateOne(
    { threadId, userId },
    {
      $setOnInsert: {
        threadId,
        userId,
        firstReplyAt: createdAt,
        unreadCount: 0,
      },
      $set: {
        lastReplyAt: createdAt,
        hasPosted: true,
        lastViewedAt: createdAt,
        lastReadReplyCreatedAt: createdAt,
        ...(instructorReply ? { hasInstructorReply: true } : {}),
      },
      $inc: {
        replyCount: 1,
        ...(isRoot ? { rootReplyCount: 1 } : {}),
      },
    },
    { upsert: true }
  );

  await DiscussionParticipation.updateMany(
    { threadId, userId: { $ne: userId } },
    {
      $inc: { unreadCount: 1 },
      ...(instructorReply ? { $set: { hasInstructorReply: true } } : {}),
    }
  );

  return getReadState(threadId, userId);
}

async function recordReplyEdited({ threadId, userId }) {
  if (!threadId || !userId) return null;
  return DiscussionParticipation.updateOne(
    { threadId, userId },
    { $inc: { editedCount: 1 } },
    { upsert: true }
  );
}

async function recordReplyDeleted({ threadId, userId }) {
  if (!threadId || !userId) return null;
  return DiscussionParticipation.updateOne(
    { threadId, userId },
    { $inc: { deletedCount: 1 } },
    { upsert: true }
  );
}

async function recordLike({ threadId, userId, delta }) {
  if (!threadId || !userId || !delta) return null;
  return DiscussionParticipation.updateOne(
    { threadId, userId },
    { $inc: { likeCount: delta } },
    { upsert: true }
  );
}

async function markThreadRead(threadId, userId, options = {}) {
  if (!threadId || !userId) return null;
  const viewedAt = options.viewedAt || new Date();
  const latestReply = await DiscussionReply.findOne({ threadId, deletedAt: null })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();
  await DiscussionParticipation.updateOne(
    { threadId, userId },
    {
      $setOnInsert: { threadId, userId },
      $set: {
        lastViewedAt: viewedAt,
        unreadCount: 0,
        lastReadReplyCreatedAt: latestReply?.createdAt || viewedAt,
      },
    },
    { upsert: true }
  );
  return getReadState(threadId, userId);
}

async function getReadState(threadId, userId) {
  const row = await DiscussionParticipation.findOne({ threadId, userId }).lean();
  return row || {
    threadId,
    userId,
    hasPosted: false,
    replyCount: 0,
    rootReplyCount: 0,
    likeCount: 0,
    editedCount: 0,
    deletedCount: 0,
    hasInstructorReply: false,
    lastViewedAt: null,
    unreadCount: 0,
    lastReadReplyCreatedAt: null,
  };
}

async function summariesForUser(threadIds, userId) {
  if (!threadIds?.length || !userId) return new Map();
  const rows = await DiscussionParticipation.find({
    threadId: { $in: threadIds },
    userId,
  }).lean();
  return new Map(rows.map((row) => [normalizeId(row.threadId), row]));
}

async function participantPreview(threadId, limit = 10) {
  return DiscussionParticipation.find({ threadId, hasPosted: true })
    .sort({ lastReplyAt: -1 })
    .limit(Math.min(50, Math.max(1, parseInt(limit, 10) || 10)))
    .populate('userId', 'firstName lastName role profilePicture')
    .lean();
}

async function recalculateThreadParticipation(threadId) {
  await DiscussionParticipation.deleteMany({ threadId });
  const cursor = DiscussionReply.find({ threadId }).sort({ createdAt: 1 }).cursor();
  for await (const reply of cursor) {
    await recordReplyCreated({
      thread: { _id: reply.threadId },
      reply,
      user: { _id: reply.authorId, role: 'student' },
      isRoot: !reply.parentReplyId,
    });
    if (reply.editHistory?.length) {
      await DiscussionParticipation.updateOne(
        { threadId, userId: reply.authorId },
        { $inc: { editedCount: reply.editHistory.length } }
      );
    }
    if (reply.deletedAt) {
      await recordReplyDeleted({ threadId, userId: reply.authorId });
    }
  }
}

module.exports = {
  getReadState,
  markThreadRead,
  participantPreview,
  recalculateThreadParticipation,
  recordLike,
  recordReplyCreated,
  recordReplyDeleted,
  recordReplyEdited,
  summariesForUser,
};
