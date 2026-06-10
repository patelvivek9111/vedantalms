const { incrWithExpire, getNumber, getRedisClient } = require('../utils/cache');
const messageAudit = require('./messageAudit.service');

const memoryCounters = new Map();

function isAntiSpamEnabled() {
  return process.env.INBOX_ANTISPAM_ENFORCED === 'true';
}

function intEnv(name, fallback) {
  const n = parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function spamError(message, code, statusCode = 429, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function memoryIncrement(key, windowSeconds) {
  const now = Date.now();
  const entry = memoryCounters.get(key);
  if (!entry || entry.expiresAt <= now) {
    const next = { count: 1, expiresAt: now + windowSeconds * 1000 };
    memoryCounters.set(key, next);
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

async function incrementWindow(key, windowSeconds) {
  const redisCount = await incrWithExpire(key, windowSeconds);
  if (redisCount != null) return redisCount;
  if (!getRedisClient()) {
    return memoryIncrement(key, windowSeconds);
  }
  return memoryIncrement(key, windowSeconds);
}

async function assertWithinLimit({ key, windowSeconds, max, code, message }) {
  const count = await incrementWindow(key, windowSeconds);
  if (count > max) {
    throw spamError(message, code, 429, { max, windowSeconds, count });
  }
  return count;
}

/**
 * Throttle new conversation creation (and send-individually batches count as N).
 */
async function currentWindowCount(key, windowSeconds) {
  const redisVal = await getNumber(key);
  if (getRedisClient()) return redisVal;
  const entry = memoryCounters.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return 0;
  return entry.count;
}

async function assertCanCreateConversations(userId, { batchSize = 1 }) {
  if (!isAntiSpamEnabled()) return;
  const maxPerHour = intEnv('INBOX_MAX_CONVERSATIONS_PER_HOUR', 40);
  const windowSeconds = intEnv('INBOX_CONVERSATION_WINDOW_SEC', 3600);
  const key = `inbox:spam:compose:${userId}`;
  const current = await currentWindowCount(key, windowSeconds);
  if (current + batchSize > maxPerHour) {
    throw spamError(
      'Too many new conversations. Please try again later.',
      'INBOX_COMPOSE_RATE',
      429,
      { max: maxPerHour, batchSize, current }
    );
  }
  for (let i = 0; i < batchSize; i += 1) {
    await incrementWindow(key, windowSeconds);
  }
  if (batchSize > 1) {
    const batchKey = `inbox:spam:compose_batch:${userId}`;
    await assertWithinLimit({
      key: batchKey,
      windowSeconds: 300,
      max: intEnv('INBOX_MAX_BATCH_COMPOSE_5MIN', 15),
      code: 'INBOX_COMPOSE_BATCH_RATE',
      message: 'Too many messages sent at once. Please slow down.',
    });
  }
}

/**
 * Throttle replies / thread messages per user.
 */
async function assertCanSendMessage(userId, { conversationId, bodyText }) {
  if (!isAntiSpamEnabled()) return;
  const maxPerMinute = intEnv('INBOX_MAX_MESSAGES_PER_MINUTE', 30);
  await assertWithinLimit({
    key: `inbox:spam:send:${userId}`,
    windowSeconds: 60,
    max: maxPerMinute,
    code: 'INBOX_SEND_RATE',
    message: 'Too many messages. Please wait before sending again.',
  });

  const duplicateWindow = intEnv('INBOX_DUPLICATE_WINDOW_SEC', 90);
  const bodyHash = messageAudit.hashBodyPreview(bodyText);
  const dupKey = `inbox:spam:dup:${userId}:${conversationId}:${bodyHash}`;
  const dupCount = await incrementWindow(dupKey, duplicateWindow);
  if (dupCount > 1) {
    throw spamError(
      'Duplicate message detected. Please wait before resending the same content.',
      'INBOX_DUPLICATE_MESSAGE',
      429,
      { conversationId: String(conversationId) }
    );
  }
}

async function handleSpamViolation(req, err) {
  if (err?.code && String(err.code).startsWith('INBOX_')) {
    await messageAudit.recordSpamBlocked(req, {
      code: err.code,
      conversationId: req?.params?.conversationId,
      metadata: err.details || {},
    }).catch(() => {});
  }
}

module.exports = {
  isAntiSpamEnabled,
  assertCanCreateConversations,
  assertCanSendMessage,
  handleSpamViolation,
  incrementWindow,
};
