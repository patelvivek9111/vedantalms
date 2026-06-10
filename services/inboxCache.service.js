const { getJson, setJson, delJson, incr, getNumber } = require('../utils/cache');

const CACHE_VERSION = process.env.INBOX_CACHE_VERSION || 'v3';
const FOLDER_KEYS = ['inbox', 'sent', 'archived', 'deleted', 'all'];
const DEFAULT_MESSAGE_LIMITS = [50, 100, 200];

function normalizeUserId(id) {
  if (!id) return '';
  return id.toString ? id.toString() : String(id);
}

function conversationListKey(userId, folder) {
  return `inbox:${CACHE_VERSION}:convos:${normalizeUserId(userId)}:${folder || 'all'}`;
}

function unreadTotalKey(userId) {
  return `inbox:${CACHE_VERSION}:unread:${normalizeUserId(userId)}`;
}

/** @deprecated v1 list keys — invalidated during rollout */
function legacyConversationListKey(userId, folder) {
  return `inbox:conversations:${normalizeUserId(userId)}:${folder || 'all'}`;
}

function messageGenerationKey(conversationId) {
  return `inbox:${CACHE_VERSION}:msggen:${conversationId}`;
}

/** @deprecated v1 message page key */
function legacyMessagePageKey(userId, conversationId, limit, cursor) {
  return `inbox:messages:${normalizeUserId(userId)}:${conversationId}:${limit}:${cursor || 'start'}`;
}

async function getMessageGeneration(conversationId) {
  const n = await getNumber(messageGenerationKey(conversationId));
  return Number.isFinite(n) ? n : 0;
}

async function buildMessageCacheKey(userId, conversationId, limit, cursor) {
  const gen = await getMessageGeneration(conversationId);
  return `inbox:${CACHE_VERSION}:msgs:${normalizeUserId(userId)}:${conversationId}:${limit}:${cursor || 'start'}:g${gen}`;
}

async function bumpMessageCacheGeneration(conversationId) {
  await incr(messageGenerationKey(conversationId));
}

async function invalidateConversationLists(userIds) {
  const ids = [...new Set((userIds || []).map(normalizeUserId).filter(Boolean))];
  const deletes = ids.flatMap((idStr) =>
    FOLDER_KEYS.flatMap((folder) => [
      delJson(conversationListKey(idStr, folder)),
      delJson(legacyConversationListKey(idStr, folder)),
    ])
  );
  await Promise.all(deletes);
}

/**
 * Invalidate thread message caches after send/read without Redis SCAN.
 * v2: generation bump; v1: delete common first-page keys per participant.
 */
async function invalidateMessageCaches(conversationId, participantUserIds = []) {
  if (!conversationId) return;
  await bumpMessageCacheGeneration(conversationId);

  const ids = [...new Set((participantUserIds || []).map(normalizeUserId).filter(Boolean))];
  const legacyDeletes = ids.flatMap((userId) =>
    DEFAULT_MESSAGE_LIMITS.map((limit) => delJson(legacyMessagePageKey(userId, conversationId, limit, 'start')))
  );
  await Promise.all(legacyDeletes);
}

async function invalidateUnreadTotals(userIds) {
  const ids = [...new Set((userIds || []).map(normalizeUserId).filter(Boolean))];
  await Promise.all(ids.map((id) => delJson(unreadTotalKey(id))));
}

async function invalidateAfterMessageChange(conversationId, participantUserIds) {
  await Promise.all([
    invalidateConversationLists(participantUserIds),
    invalidateMessageCaches(conversationId, participantUserIds),
    invalidateUnreadTotals(participantUserIds),
  ]);
}

module.exports = {
  CACHE_VERSION,
  conversationListKey,
  unreadTotalKey,
  buildMessageCacheKey,
  getMessageGeneration,
  bumpMessageCacheGeneration,
  invalidateConversationLists,
  invalidateMessageCaches,
  invalidateAfterMessageChange,
  invalidateUnreadTotals,
  getJson,
  setJson,
};
