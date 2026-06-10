const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const messageAudit = require('../services/messageAudit.service');

const applyApiRateLimits =
  process.env.NODE_ENV === 'production'
    ? process.env.DISABLE_RATE_LIMIT !== 'true'
    : process.env.ENFORCE_RATE_LIMIT_IN_DEV === 'true';

const skipInboxLimiters = () => !applyApiRateLimits;

function buildInboxLimiter({ windowMs, max, limitType, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInboxLimiters,
    keyGenerator: (req) => {
      const userId = req.user?._id?.toString();
      if (userId) return userId;
      return ipKeyGenerator(req.ip);
    },
    message: { error: message, code: 'INBOX_RATE_LIMITED', limitType },
    handler: (req, res, _next, options) => {
      messageAudit
        .recordRateLimited(req, { limitType, path: req.path })
        .catch(() => {});
      res.status(options.statusCode).json(options.message);
    },
  });
}

/** Stricter than global writeLimiter for new threads. */
const inboxComposeLimiter = buildInboxLimiter({
  windowMs: parseInt(process.env.INBOX_COMPOSE_WINDOW_MS || `${60 * 1000}`, 10),
  max: parseInt(process.env.INBOX_COMPOSE_MAX || '12', 10),
  limitType: 'compose',
  message: 'Too many new conversations. Please slow down.',
});

/** Per-thread sends (replies). */
const inboxSendLimiter = buildInboxLimiter({
  windowMs: parseInt(process.env.INBOX_SEND_WINDOW_MS || `${60 * 1000}`, 10),
  max: parseInt(process.env.INBOX_SEND_MAX || '45', 10),
  limitType: 'send',
  message: 'Too many messages sent. Please slow down.',
});

module.exports = {
  inboxComposeLimiter,
  inboxSendLimiter,
  skipInboxLimiters,
};
