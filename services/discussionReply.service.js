const mongoose = require('mongoose');
const DiscussionReply = require('../models/discussionReply.model');
const Thread = require('../models/thread.model');
const discussionCounterService = require('./discussionCounter.service');
const discussionParticipation = require('./discussionParticipation.service');
const { sanitizeDiscussionHtml } = require('./discussionSanitizer.service');
const discussionObservability = require('./discussionObservability.service');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_REPLY_DEPTH = 1;
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
    .populate('likes.user', '_id firstName lastName')
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

function replyParentId(reply) {
  const parent = reply?.parentReply ?? reply?.parentReplyId ?? null;
  return parent ? normalizeId(parent) : null;
}

function legacyReplyToCompat(reply) {
  const obj = reply?.toObject ? reply.toObject() : { ...reply };
  const parent = replyParentId(obj);
  return {
    ...obj,
    author: obj.author,
    parentReply: parent,
    parentReplyId: parent,
    sanitizedContent: obj.content || '',
    childCount: obj.childCount || 0,
    likeCount: Array.isArray(obj.likes) ? obj.likes.length : obj.likeCount || 0,
    depth: obj.depth || 0,
    path: obj.path || '',
    moderationState: obj.moderationState || 'active',
  };
}

function sortRepliesChronologically(replies) {
  return [...replies].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    return String(a._id).localeCompare(String(b._id));
  });
}

function paginateSortedReplies(sortedReplies, options = {}) {
  const limit = parseLimit(options.limit);
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  let start = options.cursor ? 0 : (page - 1) * limit;
  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (decoded) {
      const idx = sortedReplies.findIndex((reply) => {
        const createdAt = new Date(reply.createdAt).getTime();
        const cursorAt = decoded.createdAt.getTime();
        return createdAt > cursorAt || (createdAt === cursorAt && String(reply._id) > decoded.id);
      });
      start = idx < 0 ? sortedReplies.length : idx;
    }
  }
  const slice = sortedReplies.slice(start, start + limit + 1);
  const hasMore = slice.length > limit;
  const pageRows = hasMore ? slice.slice(0, limit) : slice;
  return {
    replies: pageRows,
    pagination: {
      page,
      limit,
      total: sortedReplies.length,
      totalPages: Math.ceil(sortedReplies.length / limit) || 1,
      nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1]) : null,
    },
  };
}

async function getMigratedLegacyReplyIds(threadId) {
  const rows = await DiscussionReply.find({ threadId, legacyReplyId: { $ne: null } })
    .select('legacyReplyId')
    .lean();
  return new Set(rows.map((row) => normalizeId(row.legacyReplyId)).filter(Boolean));
}

async function loadEmbeddedReplies(threadId, thread) {
  if (Array.isArray(thread?.replies)) {
    return thread.replies;
  }
  const legacyThread = await Thread.findById(threadId)
    .select('replies')
    .populate('replies.author', '_id firstName lastName role profilePicture')
    .populate('replies.fileAssets', 'originalName mimeType size path')
    .populate('replies.likes.user', '_id firstName lastName')
    .populate('replies.deletedBy', 'firstName lastName role');
  return legacyThread?.replies || [];
}

function activeEmbeddedReplies(embedded, migratedLegacyIds = new Set()) {
  return (embedded || []).filter(
    (reply) => !reply.deletedAt && !migratedLegacyIds.has(normalizeId(reply._id))
  );
}

async function attachCollectionChildCounts(threadId, replies) {
  if (!replies?.length) return replies || [];
  if (!mongoose.Types.ObjectId.isValid(threadId)) return replies;
  const threadOid = new mongoose.Types.ObjectId(threadId);
  const parentIds = replies
    .map((reply) => reply._id)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!parentIds.length) return replies;

  const rows = await DiscussionReply.aggregate([
    {
      $match: {
        threadId: threadOid,
        parentReplyId: { $in: parentIds },
        deletedAt: null,
      },
    },
    { $group: { _id: '$parentReplyId', n: { $sum: 1 } } },
  ]);
  const countByParent = new Map(rows.map((row) => [String(row._id), row.n]));
  return replies.map((reply) => {
    const collectionChildren = countByParent.get(String(reply._id)) || 0;
    return {
      ...reply,
      childCount: Math.max(Number(reply.childCount) || 0, collectionChildren),
    };
  });
}

async function hasCollectionReplies(threadId) {
  return (await DiscussionReply.exists({ threadId, deletedAt: null })) != null;
}

function activeCollectionMatch(extra = {}) {
  return { deletedAt: null, ...extra };
}

function visibleReplies(replies) {
  return (replies || []).filter((reply) => !reply?.deletedAt && !reply?.isDeleted);
}

async function getReplyById(replyId) {
  if (!mongoose.Types.ObjectId.isValid(replyId)) return null;
  return populateReplyQuery(DiscussionReply.findById(replyId));
}

async function findLegacyEmbeddedReply(threadOrId, replyId) {
  const threadId = normalizeId(threadOrId);
  const replyKey = normalizeId(replyId);
  if (!threadId || !replyKey) return null;

  let threadDoc = threadOrId;
  if (!threadDoc?.replies?.id) {
    threadDoc = await Thread.findById(threadId).select('replies');
  }
  const legacy = threadDoc?.replies?.id ? threadDoc.replies.id(replyKey) : null;
  if (legacy && !legacy.deletedAt) return legacy;
  return null;
}

async function getReplyOrLegacy(thread, replyId) {
  const collectionReply = await getReplyById(replyId);
  if (collectionReply) return { source: 'collection', reply: collectionReply };
  const legacy = await findLegacyEmbeddedReply(thread, replyId);
  return legacy ? { source: 'legacy', reply: legacy } : null;
}

async function listRootReplies(thread, options = {}) {
  const threadId = normalizeId(thread);
  const limit = parseLimit(options.limit);
  const page = Math.max(1, parseInt(options.page, 10) || 1);

  if (await hasCollectionReplies(threadId)) {
    const embedded = await loadEmbeddedReplies(threadId, thread);
    const migratedLegacyIds = await getMigratedLegacyReplyIds(threadId);
    const unmigratedEmbedded = activeEmbeddedReplies(embedded, migratedLegacyIds);
    const hasUnmigratedEmbedded = unmigratedEmbedded.length > 0;

    if (!hasUnmigratedEmbedded) {
      const query = activeCollectionMatch({
        threadId,
        parentReplyId: null,
        ...cursorFilter(options.cursor),
      });
      const skip = options.cursor ? 0 : (page - 1) * limit;
      const [rows, total] = await Promise.all([
        populateReplyQuery(
          DiscussionReply.find(query).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit + 1)
        ),
        DiscussionReply.countDocuments(activeCollectionMatch({ threadId, parentReplyId: null })),
      ]);
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      return {
        replies: await attachCollectionChildCounts(threadId, pageRows.map(toLegacyReply)),
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

    const collectionRows = await populateReplyQuery(
      DiscussionReply.find(activeCollectionMatch({ threadId, parentReplyId: null })).sort({ createdAt: 1, _id: 1 })
    );
    const legacyRoots = unmigratedEmbedded
      .filter((reply) => !replyParentId(reply))
      .map(legacyReplyToCompat);
    const merged = sortRepliesChronologically([
      ...collectionRows.map(toLegacyReply),
      ...legacyRoots,
    ]);
    const paged = paginateSortedReplies(merged, options);
    return {
      replies: await attachCollectionChildCounts(threadId, paged.replies),
      pagination: paged.pagination,
      source: 'mixed',
    };
  }

  const legacy = (await loadEmbeddedReplies(threadId, thread)).filter(
    (reply) => !replyParentId(reply) && !reply.deletedAt
  );
  const start = (page - 1) * limit;
  return {
    replies: await attachCollectionChildCounts(
      threadId,
      legacy.slice(start, start + limit).map(legacyReplyToCompat)
    ),
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
  const parentId = normalizeId(parentReplyId);
  const parent = await DiscussionReply.findById(parentId).lean();
  let threadId = parent ? normalizeId(parent.threadId) : null;

  if (!threadId) {
    const threadDoc = await Thread.findOne({ 'replies._id': parentId }).select('_id').lean();
    if (!threadDoc) {
      const limit = parseLimit(options.limit);
      const page = Math.max(1, parseInt(options.page, 10) || 1);
      return {
        replies: [],
        pagination: { page, limit, total: 0, totalPages: 1, nextCursor: null },
        source: 'collection',
      };
    }
    threadId = normalizeId(threadDoc._id);
  }

  const migratedLegacyIds = await getMigratedLegacyReplyIds(threadId);
  const embedded = await loadEmbeddedReplies(threadId, null);
  const unmigratedEmbedded = activeEmbeddedReplies(embedded, migratedLegacyIds);
  const legacyChildren = unmigratedEmbedded
    .filter((reply) => replyParentId(reply) === parentId)
    .map(legacyReplyToCompat);

  if (!legacyChildren.length) {
    const limit = parseLimit(options.limit);
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const query = activeCollectionMatch({
      threadId,
      parentReplyId: parentId,
      ...cursorFilter(options.cursor),
    });
    const skip = options.cursor ? 0 : (page - 1) * limit;
    const [rows, total] = await Promise.all([
      populateReplyQuery(
        DiscussionReply.find(query).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit + 1)
      ),
      DiscussionReply.countDocuments(activeCollectionMatch({ threadId, parentReplyId: parentId })),
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

  const collectionRows = await populateReplyQuery(
    DiscussionReply.find(activeCollectionMatch({ threadId, parentReplyId: parentId })).sort({ createdAt: 1, _id: 1 })
  );
  const merged = sortRepliesChronologically([
    ...collectionRows.map(toLegacyReply),
    ...legacyChildren,
  ]);
  const paged = paginateSortedReplies(visibleReplies(merged), options);
  return {
    replies: paged.replies,
    pagination: paged.pagination,
    source: legacyChildren.length && collectionRows.length ? 'mixed' : legacyChildren.length ? 'legacy' : 'collection',
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
    let legacyParent = null;
    parent = await DiscussionReply.findOne({ _id: parentReplyId, threadId: thread._id, deletedAt: null });
    if (!parent) {
      legacyParent = await findLegacyEmbeddedReply(thread, parentReplyId);
      if (!legacyParent) {
        const err = new Error('Parent reply not found');
        err.statusCode = 404;
        err.code = 'PARENT_REPLY_NOT_FOUND';
        throw err;
      }
    }
    const parentDepth = parent
      ? parent.depth ?? (parent.parentReplyId ? 1 : 0)
      : legacyParent?.parentReply
        ? 1
        : 0;
    if (parentDepth + 1 > MAX_REPLY_DEPTH) {
      const err = new Error('You can only reply to a main discussion post');
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
  const deletedPlaceholder = '[deleted]';
  reply.deletedAt = new Date();
  reply.deletedBy = user._id;
  reply.deletedReason = reason || null;
  reply.moderatorNote = moderatorNote || null;
  if (!Array.isArray(reply.editHistory)) reply.editHistory = [];
  reply.editHistory.push({
    editedAt: reply.deletedAt,
    editedBy: user._id,
    previousContent: reply.content,
    previousSanitizedContent: reply.sanitizedContent,
    previousFileAssets: [...(reply.fileAssets || [])],
    previousAttachments: [...(reply.attachments || [])],
    reason: reason || 'deleted',
  });
  reply.editHistory = reply.editHistory.slice(-10);
  if (!reply.moderation || typeof reply.moderation !== 'object') {
    reply.moderation = {};
  }
  reply.moderation.lastAction = 'deleted';
  reply.moderation.lastActionAt = reply.deletedAt;
  reply.moderation.lastActionBy = user._id;
  reply.content = deletedPlaceholder;
  reply.sanitizedContent = sanitizeDiscussionHtml(deletedPlaceholder);
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
    if (lastSnapshot?.previousFileAssets?.length) {
      reply.fileAssets = [...lastSnapshot.previousFileAssets];
      reply.attachments = lastSnapshot.previousAttachments?.length
        ? [...lastSnapshot.previousAttachments]
        : [...lastSnapshot.previousFileAssets];
    }
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
  if (normalizeId(reply.authorId) === normalizeId(user)) {
    const err = new Error('You cannot like your own reply');
    err.statusCode = 400;
    err.code = 'SELF_LIKE_FORBIDDEN';
    throw err;
  }

  const existingIndex = (reply.likes || []).findIndex((like) => normalizeId(like.user) === normalizeId(user));
  const delta = existingIndex > -1 ? -1 : 1;
  if (existingIndex > -1) {
    reply.likes.splice(existingIndex, 1);
  } else {
    reply.likes.push({ user: user._id, likedAt: new Date() });
  }
  reply.likeCount = Math.max(0, (reply.likeCount || 0) + delta);
  await reply.save({ timestamps: false });
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

/**
 * Batch variant of hasReplyByUser for planner/todo list filtering (2 queries vs N).
 * Returns Set of threadId strings where the user has posted (collection or embedded replies).
 */
/**
 * Gradebook-scale batch: which students have replied on which threads (2–3 queries total).
 * Returns Map<studentId, Set<threadId>>.
 */
async function batchStudentDiscussionParticipation(studentIds, threadIds) {
  const map = new Map();
  const uniqueStudents = [...new Set(studentIds.map(normalizeId).filter(Boolean))];
  const uniqueThreads = [...new Set(threadIds.map(normalizeId).filter(Boolean))];
  for (const sid of uniqueStudents) map.set(sid, new Set());
  if (!uniqueStudents.length || !uniqueThreads.length) return map;

  const studentOids = uniqueStudents
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const threadOids = uniqueThreads
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!studentOids.length || !threadOids.length) return map;

  const collectionHits = await DiscussionReply.aggregate([
    {
      $match: {
        threadId: { $in: threadOids },
        authorId: { $in: studentOids },
        deletedAt: null,
      },
    },
    { $group: { _id: { studentId: '$authorId', threadId: '$threadId' } } },
  ]);
  for (const row of collectionHits) {
    const sid = String(row._id.studentId);
    map.get(sid)?.add(String(row._id.threadId));
  }

  const threads = await Thread.find({ _id: { $in: threadOids } }).select('replies').lean();
  for (const thread of threads) {
    const tid = String(thread._id);
    for (const reply of thread.replies || []) {
      if (reply.deletedAt) continue;
      const sid = normalizeId(reply.author);
      map.get(sid)?.add(tid);
    }
  }

  return map;
}

/**
 * Earliest non-deleted reply timestamp per thread for one user (collection + embedded).
 * Returns Map<threadId, Date>.
 */
async function batchFirstReplyCreatedAtByUser(threadIds, userId) {
  const result = new Map();
  const unique = [...new Set(threadIds.map(normalizeId).filter(Boolean))];
  const uid = normalizeId(userId);
  if (!unique.length || !uid) return result;

  const oids = unique
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!oids.length) return result;

  const authorOid = mongoose.Types.ObjectId.isValid(uid)
    ? new mongoose.Types.ObjectId(uid)
    : uid;

  const collectionHits = await DiscussionReply.aggregate([
    {
      $match: {
        threadId: { $in: oids },
        authorId: authorOid,
        deletedAt: null,
      },
    },
    { $group: { _id: '$threadId', firstAt: { $min: '$createdAt' } } },
  ]);
  for (const row of collectionHits) {
    if (row.firstAt) result.set(String(row._id), new Date(row.firstAt));
  }

  const remaining = oids.filter((oid) => !result.has(String(oid)));
  if (!remaining.length) return result;

  const threads = await Thread.find({ _id: { $in: remaining } }).select('replies').lean();
  for (const thread of threads) {
    let minAt = null;
    for (const reply of thread.replies || []) {
      if (reply.deletedAt) continue;
      if (normalizeId(reply.author) !== uid) continue;
      const at = reply.createdAt ? new Date(reply.createdAt) : null;
      if (!at || Number.isNaN(at.getTime())) continue;
      if (!minAt || at.getTime() < minAt.getTime()) minAt = at;
    }
    if (minAt) result.set(String(thread._id), minAt);
  }

  return result;
}

async function batchThreadIdsRepliedByUser(threadIds, userId) {
  const replied = new Set();
  const unique = [...new Set(threadIds.map(normalizeId).filter(Boolean))];
  const uid = normalizeId(userId);
  if (!unique.length || !uid) return replied;

  const oids = unique
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!oids.length) return replied;

  const authorOid = mongoose.Types.ObjectId.isValid(uid)
    ? new mongoose.Types.ObjectId(uid)
    : uid;

  const collectionHits = await DiscussionReply.aggregate([
    {
      $match: {
        threadId: { $in: oids },
        authorId: authorOid,
        deletedAt: null,
      },
    },
    { $group: { _id: '$threadId' } },
  ]);
  for (const row of collectionHits) {
    replied.add(String(row._id));
  }

  const remaining = oids.filter((oid) => !replied.has(String(oid)));
  if (!remaining.length) return replied;

  const threads = await Thread.find({ _id: { $in: remaining } }).select('replies').lean();
  for (const thread of threads) {
    const hasEmbedded = (thread.replies || []).some(
      (reply) => !reply.deletedAt && normalizeId(reply.author) === uid
    );
    if (hasEmbedded) replied.add(String(thread._id));
  }

  return replied;
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
  batchStudentDiscussionParticipation,
  batchFirstReplyCreatedAtByUser,
  batchThreadIdsRepliedByUser,
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

