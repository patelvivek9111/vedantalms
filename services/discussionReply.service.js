const mongoose = require('mongoose');
const DiscussionReply = require('../models/discussionReply.model');
const Thread = require('../models/thread.model');
const discussionCounterService = require('./discussionCounter.service');
const discussionParticipation = require('./discussionParticipation.service');
const { sanitizeDiscussionHtml } = require('./discussionSanitizer.service');
const discussionObservability = require('./discussionObservability.service');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_REPLY_DEPTH = 10;
const MAX_REPLY_CONTENT_LENGTH = 50000;

function normalizeId(value) {
  if (!value) return null;
  return String(value._id || value);
}

function parseLimit(value) {
  return Math.min(MAX_LIMIT, Math.max(1, parseInt(value, 10) || DEFAULT_LIMIT));
}

function assertReplyContentSafe(content) {
  if (!content || !String(content).trim()) {
    const err = new Error('Reply content is required');
    err.statusCode = 400;
    err.code = 'REPLY_CONTENT_REQUIRED';
    throw err;
  }
  if (String(content).length > MAX_REPLY_CONTENT_LENGTH) {
    const err = new Error('Reply content exceeds the maximum allowed size');
    err.statusCode = 413;
    err.code = 'REPLY_CONTENT_TOO_LARGE';
    throw err;
  }
}

function encodeCursor(reply) {
  if (!reply) return null;
  return Buffer.from(`${new Date(reply.createdAt).toISOString()}|${reply._id}`).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const [createdAt, id] = Buffer.from(String(cursor), 'base64url').toString('utf8').split('|');
    const date = new Date(createdAt);
    if (!Number.isFinite(date.getTime()) || !mongoose.Types.ObjectId.isValid(id)) return null;
    return { createdAt: date, id };
  } catch {
    return null;
  }
}

function cursorFilter(cursor) {
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};
  return {
    $or: [
      { createdAt: { $gt: decoded.createdAt } },
      { createdAt: decoded.createdAt, _id: { $gt: decoded.id } },
    ],
  };
}

function populateReplyQuery(query) {
  return query
    .populate('authorId', '_id firstName lastName role profilePicture')
    .populate('fileAssets', 'originalName mimeType size path')
    .populate('likes.user', 'firstName lastName')
    .populate('deletedBy', 'firstName lastName role');
}

function toLegacyReply(reply) {
  const obj = reply?.toObject ? reply.toObject() : { ...reply };
  const isHidden = obj.moderationState === 'hidden' || obj.moderation?.hidden === true;
  return {
    _id: obj._id,
    content: obj.deletedAt || isHidden ? '' : obj.sanitizedContent || obj.content || '',
    sanitizedContent: obj.sanitizedContent || '',
    author: obj.authorId,
    parentReply: obj.parentReplyId || null,
    parentReplyId: obj.parentReplyId || null,
    depth: obj.depth || 0,
    path: obj.path || '',
    fileAssets: obj.fileAssets || obj.attachments || [],
    attachments: obj.attachments || obj.fileAssets || [],
    likes: obj.likes || [],
    likeCount: obj.likeCount || 0,
    childCount: obj.childCount || 0,
    mentions: obj.mentions || [],
    deletedAt: obj.deletedAt || null,
    deletedBy: obj.deletedBy || null,
    editHistory: obj.editHistory || [],
    moderation: obj.moderation || {},
    moderationState: obj.moderationState || (obj.moderation?.hidden ? 'hidden' : 'active'),
    hiddenByModerator: obj.hiddenByModerator === true,
    isHidden,
    restoredAt: obj.restoredAt || null,
    restoredBy: obj.restoredBy || null,
    deletedReason: obj.deletedReason || null,
    moderatorNote: obj.moderatorNote || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    isDeleted: Boolean(obj.deletedAt),
  };
}

function legacyReplyToCompat(reply) {
  const obj = reply?.toObject ? reply.toObject() : { ...reply };
  return {
    ...obj,
    author: obj.author,
    parentReply: obj.parentReply || null,
    parentReplyId: obj.parentReply || null,
    sanitizedContent: obj.content || '',
    childCount: 0,
    likeCount: Array.isArray(obj.likes) ? obj.likes.length : 0,
    depth: 0,
    path: '',
    moderationState: obj.moderationState || 'active',
  };
}

async function hasCollectionReplies(threadId) {
  return (await DiscussionReply.exists({ threadId })) != null;
}

async function getReplyById(replyId) {
  if (!mongoose.Types.ObjectId.isValid(replyId)) return null;
  return populateReplyQuery(DiscussionReply.findById(replyId));
}

async function getReplyOrLegacy(thread, replyId) {
  const collectionReply = await getReplyById(replyId);
  if (collectionReply) return { source: 'collection', reply: collectionReply };
  const legacyThread = thread?.replies?.id
    ? thread
    : await Thread.findById(normalizeId(thread)).select('replies');
  const legacy = legacyThread?.replies?.id ? legacyThread.replies.id(replyId) : null;
  return legacy ? { source: 'legacy', reply: legacy } : null;
}

async function listRootReplies(thread, options = {}) {
  const threadId = normalizeId(thread);
  const limit = parseLimit(options.limit);
  const page = Math.max(1, parseInt(options.page, 10) || 1);

  if (await hasCollectionReplies(threadId)) {
    const query = {
      threadId,
      parentReplyId: null,
      ...cursorFilter(options.cursor),
    };
    const skip = options.cursor ? 0 : (page - 1) * limit;
    const [rows, total] = await Promise.all([
      populateReplyQuery(
        DiscussionReply.find(query).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit + 1)
      ),
      DiscussionReply.countDocuments({ threadId, parentReplyId: null }),
    ]);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      replies: pageRows.map(toLegacyReply),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1]) : null,
      },
      source: 'collection',
    };
  }

  const legacyThread = Array.isArray(thread.replies)
    ? thread
    : await Thread.findById(threadId)
        .select('replies')
        .populate('replies.author', '_id firstName lastName role profilePicture')
        .populate('replies.fileAssets', 'originalName mimeType size path')
        .populate('replies.likes.user', 'firstName lastName')
        .populate('replies.deletedBy', 'firstName lastName role');
  const legacy = (legacyThread?.replies || []).filter((reply) => !reply.parentReply);
  const start = (page - 1) * limit;
  return {
    replies: legacy.slice(start, start + limit).map(legacyReplyToCompat),
    pagination: {
      page,
      limit,
      total: legacy.length,
      totalPages: Math.ceil(legacy.length / limit) || 1,
      nextCursor: null,
    },
    source: 'legacy',
  };
}

async function listChildReplies(parentReplyId, options = {}) {
  const limit = parseLimit(options.limit);
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const parent = await DiscussionReply.findById(parentReplyId).lean();
  if (!parent) {
    return {
      replies: [],
      pagination: { page, limit, total: 0, totalPages: 1, nextCursor: null },
      source: 'collection',
    };
  }
  const query = {
    threadId: parent.threadId,
    parentReplyId,
    ...cursorFilter(options.cursor),
  };
  const skip = options.cursor ? 0 : (page - 1) * limit;
  const [rows, total] = await Promise.all([
    populateReplyQuery(DiscussionReply.find(query).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit + 1)),
    DiscussionReply.countDocuments({ threadId: parent.threadId, parentReplyId }),
  ]);
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    replies: pageRows.map(toLegacyReply),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1]) : null,
    },
    source: 'collection',
  };
}

async function createReply({ thread, user, content, parentReplyId = null, fileAssetIds = [], idempotencyKey = null }) {
  const existing =
    idempotencyKey &&
    (await DiscussionReply.findOne({
      threadId: thread._id,
      authorId: user._id,
      idempotencyKey,
    }));
  if (existing) {
    discussionObservability.replyDuplicateSuppressed({
      threadId: String(thread._id),
      userId: String(user._id),
    });
    return { reply: await populateReplyQuery(DiscussionReply.findById(existing._id)), duplicateSuppressed: true };
  }

  let parent = null;
  assertReplyContentSafe(content);
  if (parentReplyId) {
    parent = await DiscussionReply.findOne({ _id: parentReplyId, threadId: thread._id, deletedAt: null });
    if (!parent) {
      const legacyParent = thread.replies?.id ? thread.replies.id(parentReplyId) : null;
      if (!legacyParent || legacyParent.deletedAt) {
        const err = new Error('Parent reply not found');
        err.statusCode = 404;
        err.code = 'PARENT_REPLY_NOT_FOUND';
        throw err;
      }
    }
    const parentDepth = parent ? parent.depth || 0 : 0;
    if (parentDepth + 1 > MAX_REPLY_DEPTH) {
      const err = new Error('Maximum discussion reply depth exceeded');
      err.statusCode = 400;
      err.code = 'REPLY_DEPTH_EXCEEDED';
      throw err;
    }
  }

  const sanitizedContent = sanitizeDiscussionHtml(content);
  let reply;
  try {
    reply = await DiscussionReply.create({
      threadId: thread._id,
      parentReplyId: parent ? parent._id : parentReplyId || null,
      authorId: user._id,
      content,
      sanitizedContent,
      depth: parent ? (parent.depth || 0) + 1 : parentReplyId ? 1 : 0,
      path: parent ? `${parent.path || parent._id}/${parent._id}` : '',
      fileAssets: fileAssetIds,
      attachments: fileAssetIds,
      idempotencyKey,
    });
  } catch (error) {
    if (idempotencyKey && error?.code === 11000) {
      const duplicate = await DiscussionReply.findOne({
        threadId: thread._id,
        authorId: user._id,
        idempotencyKey,
      });
      if (duplicate) {
        discussionObservability.replyDuplicateSuppressed({
          threadId: String(thread._id),
          userId: String(user._id),
        });
        return { reply: await populateReplyQuery(DiscussionReply.findById(duplicate._id)), duplicateSuppressed: true };
      }
    }
    discussionObservability.replyCreateFailed({
      threadId: String(thread._id),
      userId: String(user._id),
      code: error?.code || null,
      message: error?.message || 'unknown',
    });
    throw error;
  }

  await discussionCounterService.incrementReplyCreated(thread._id, user._id, {
    parentReplyId: parent?._id || null,
    createdAt: reply.createdAt,
  });
  await discussionParticipation.recordReplyCreated({
    thread,
    reply,
    user,
    isRoot: !reply.parentReplyId,
  });

  return { reply: await populateReplyQuery(DiscussionReply.findById(reply._id)), duplicateSuppressed: false };
}

async function updateReply({ thread, replyId, user, content, fileAssetIds = [], removeFileAssetIds = [] }) {
  const reply = await DiscussionReply.findOne({ _id: replyId, threadId: thread._id });
  if (!reply) {
    const err = new Error('Reply not found');
    err.statusCode = 404;
    err.code = 'REPLY_NOT_FOUND';
    throw err;
  }
  if (reply.deletedAt) {
    const err = new Error('Deleted replies cannot be edited');
    err.statusCode = 400;
    err.code = 'REPLY_DELETED';
    throw err;
  }
  if (content !== undefined) {
    assertReplyContentSafe(content);
    reply.editHistory.push({
      editedAt: new Date(),
      editedBy: user._id,
      previousContent: reply.content,
      previousSanitizedContent: reply.sanitizedContent,
    });
    reply.content = content;
    reply.sanitizedContent = sanitizeDiscussionHtml(content);
    reply.editHistory = reply.editHistory.slice(-10);
    await discussionParticipation.recordReplyEdited({ threadId: thread._id, userId: reply.authorId });
  }
  if (removeFileAssetIds.length) {
    const remove = new Set(removeFileAssetIds.map(String));
    reply.fileAssets = (reply.fileAssets || []).filter((id) => !remove.has(String(id)));
    reply.attachments = (reply.attachments || []).filter((id) => !remove.has(String(id)));
  }
  if (fileAssetIds.length) {
    const ids = [...new Set([...(reply.fileAssets || []).map(String), ...fileAssetIds.map(String)])];
    reply.fileAssets = ids;
    reply.attachments = ids;
  }
  await reply.save();
  return populateReplyQuery(DiscussionReply.findById(reply._id));
}

async function softDeleteReply({ thread, replyId, user, reason = null, moderatorNote = null }) {
  const reply = await DiscussionReply.findOne({ _id: replyId, threadId: thread._id });
  if (!reply) {
    const err = new Error('Reply not found');
    err.statusCode = 404;
    err.code = 'REPLY_NOT_FOUND';
    throw err;
  }
  if (reply.deletedAt) {
    const err = new Error('Reply is already deleted');
    err.statusCode = 400;
    err.code = 'REPLY_ALREADY_DELETED';
    throw err;
  }
  reply.deletedAt = new Date();
  reply.deletedBy = user._id;
  reply.deletedReason = reason || null;
  reply.moderatorNote = moderatorNote || null;
  reply.editHistory.push({
    editedAt: reply.deletedAt,
    editedBy: user._id,
    previousContent: reply.content,
    previousSanitizedContent: reply.sanitizedContent,
    reason: reason || 'deleted',
  });
  reply.editHistory = reply.editHistory.slice(-10);
  reply.moderation.lastAction = 'deleted';
  reply.moderation.lastActionAt = reply.deletedAt;
  reply.moderation.lastActionBy = user._id;
  reply.sanitizedContent = '';
  reply.content = '';
  reply.fileAssets = [];
  reply.attachments = [];
  reply.likes = [];
  reply.likeCount = 0;
  await reply.save();
  await discussionCounterService.incrementReplyDeleted(thread._id, reply.authorId, {
    parentReplyId: reply.parentReplyId,
  });
  await discussionParticipation.recordReplyDeleted({ threadId: thread._id, userId: reply.authorId });
  return populateReplyQuery(DiscussionReply.findById(reply._id));
}

async function hideReply({ replyId, user, note = null }) {
  const reply = await DiscussionReply.findById(replyId);
  if (!reply) {
    const err = new Error('Reply not found');
    err.statusCode = 404;
    err.code = 'REPLY_NOT_FOUND';
    throw err;
  }
  reply.moderationState = 'hidden';
  reply.hiddenByModerator = true;
  reply.moderatorNote = note || reply.moderatorNote || null;
  reply.moderation.hidden = true;
  reply.moderation.hiddenAt = new Date();
  reply.moderation.hiddenBy = user._id;
  reply.moderation.note = note || null;
  reply.moderation.lastAction = 'hidden';
  reply.moderation.lastActionAt = new Date();
  reply.moderation.lastActionBy = user._id;
  await reply.save();
  return populateReplyQuery(DiscussionReply.findById(reply._id));
}

async function restoreReply({ replyId, user, note = null }) {
  const reply = await DiscussionReply.findById(replyId);
  if (!reply) {
    const err = new Error('Reply not found');
    err.statusCode = 404;
    err.code = 'REPLY_NOT_FOUND';
    throw err;
  }
  const wasDeleted = Boolean(reply.deletedAt);
  reply.moderationState = 'active';
  reply.hiddenByModerator = false;
  if (reply.deletedAt) {
    const lastSnapshot = [...(reply.editHistory || [])]
      .reverse()
      .find((entry) => entry.previousContent || entry.previousSanitizedContent);
    reply.content = lastSnapshot?.previousContent || reply.content;
    reply.sanitizedContent = lastSnapshot?.previousSanitizedContent || reply.sanitizedContent || reply.content;
    reply.deletedAt = null;
    reply.deletedBy = null;
    reply.deletedReason = null;
  }
  reply.restoredAt = new Date();
  reply.restoredBy = user._id;
  reply.moderatorNote = note || reply.moderatorNote || null;
  reply.moderation.hidden = false;
  reply.moderation.lastAction = 'restored';
  reply.moderation.lastActionAt = reply.restoredAt;
  reply.moderation.lastActionBy = user._id;
  await reply.save();
  if (wasDeleted) {
    await discussionCounterService.incrementReplyCreated(reply.threadId, reply.authorId, {
      parentReplyId: reply.parentReplyId,
      createdAt: reply.createdAt || new Date(),
    });
  }
  return populateReplyQuery(DiscussionReply.findById(reply._id));
}

async function toggleLike({ thread, replyId, user }) {
  const reply = await DiscussionReply.findOne({ _id: replyId, threadId: thread._id });
  if (!reply) {
    const err = new Error('Reply not found');
    err.statusCode = 404;
    err.code = 'REPLY_NOT_FOUND';
    throw err;
  }
  if (reply.deletedAt) {
    const err = new Error('Deleted replies cannot be liked');
    err.statusCode = 400;
    err.code = 'REPLY_DELETED';
    throw err;
  }

  const existingIndex = reply.likes.findIndex((like) => normalizeId(like.user) === normalizeId(user));
  const delta = existingIndex > -1 ? -1 : 1;
  if (existingIndex > -1) {
    reply.likes.splice(existingIndex, 1);
  } else {
    reply.likes.push({ user: user._id, likedAt: new Date() });
  }
  reply.likeCount = Math.max(0, (reply.likeCount || 0) + delta);
  await reply.save();
  await discussionCounterService.updateLikeCount(thread._id, reply._id, delta);
  await discussionParticipation.recordLike({ threadId: thread._id, userId: user._id, delta });
  return populateReplyQuery(DiscussionReply.findById(reply._id));
}

async function hasReplyByUser(threadOrId, userId) {
  const threadId = normalizeId(threadOrId);
  const exists = await DiscussionReply.exists({ threadId, authorId: userId, deletedAt: null });
  if (exists) return true;
  const thread = threadOrId?.replies ? threadOrId : await Thread.findById(threadId).select('replies').lean();
  return (thread?.replies || []).some((reply) => !reply.deletedAt && normalizeId(reply.author) === normalizeId(userId));
}

async function populateThreadReplyPage(thread, options = {}) {
  const page = await listRootReplies(thread, options);
  const obj = thread?.toObject ? thread.toObject({ virtuals: true }) : { ...thread };
  obj.replies = page.replies;
  obj.repliesPagination = page.pagination;
  obj.replySource = page.source;
  obj.replyCount = obj.counters?.replyCount ?? page.pagination.total;
  return obj;
}

/**
 * One aggregate for many threads: non-deleted replies in the DiscussionReply collection per thread.
 * Used to fix list views that `.select('-replies')` and skip populateThreadReplyPage (limit 0),
 * where thread.counters.replyCount can be stale or missing after migrations.
 */
async function batchCountRepliesByThreadId(threadIds) {
  const result = new Map();
  const unique = [...new Set(threadIds.map(normalizeId).filter(Boolean))];
  if (!unique.length) return result;
  const oids = unique.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (!oids.length) return result;
  const rows = await DiscussionReply.aggregate([
    { $match: { threadId: { $in: oids }, deletedAt: null } },
    { $group: { _id: '$threadId', n: { $sum: 1 } } },
  ]);
  for (const row of rows) {
    result.set(String(row._id), row.n);
  }
  return result;
}

/**
 * For discussion list APIs: max of (collection reply rows, embedded thread.replies[], counters.replyCount)
 * per thread so counts stay correct before/after migration and when list queries omit `replies`.
 */
async function batchResolveReplyCountsForList(threadIds) {
  const unique = [...new Set(threadIds.map(normalizeId).filter(Boolean))];
  const out = new Map();
  if (!unique.length) return out;

  const oids = unique.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (!oids.length) return out;

  const [collectionRows, threadRows] = await Promise.all([
    DiscussionReply.aggregate([
      { $match: { threadId: { $in: oids }, deletedAt: null } },
      { $group: { _id: '$threadId', n: { $sum: 1 } } },
    ]),
    Thread.aggregate([
      { $match: { _id: { $in: oids } } },
      {
        $project: {
          _id: 1,
          counterVal: { $ifNull: ['$counters.replyCount', 0] },
          embeddedActive: {
            $size: {
              $filter: {
                input: { $ifNull: ['$replies', []] },
                as: 'r',
                cond: {
                  $or: [
                    { $eq: ['$$r.deletedAt', null] },
                    { $eq: [{ $type: '$$r.deletedAt' }, 'missing'] },
                  ],
                },
              },
            },
          },
        },
      },
    ]),
  ]);

  for (const row of threadRows) {
    const tid = String(row._id);
    const n = Math.max(Number(row.embeddedActive) || 0, Number(row.counterVal) || 0);
    out.set(tid, n);
  }
  for (const row of collectionRows) {
    const tid = String(row._id);
    const prev = out.get(tid) || 0;
    out.set(tid, Math.max(prev, Number(row.n) || 0));
  }

  return out;
}

module.exports = {
  batchCountRepliesByThreadId,
  batchResolveReplyCountsForList,
  createReply,
  getReplyById,
  getReplyOrLegacy,
  hasCollectionReplies,
  hasReplyByUser,
  hideReply,
  listChildReplies,
  listRootReplies,
  populateThreadReplyPage,
  restoreReply,
  softDeleteReply,
  toLegacyReply,
  toggleLike,
  updateReply,
};

