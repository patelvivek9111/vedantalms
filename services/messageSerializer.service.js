const { sanitizeMessageHtml, htmlToPlainText } = require('./messageSanitizer.service');

function toPlainObject(msg) {
  if (!msg) return null;
  if (typeof msg.toObject === 'function') return msg.toObject();
  return { ...msg };
}

/**
 * API serializer: legacy `body` remains but always contains sanitized HTML.
 * Adds bodyHtml/bodyText for new clients. Re-sanitizes legacy rows on read when needed.
 */
function serializeMessageForClient(msg) {
  const plain = toPlainObject(msg);
  if (!plain) return plain;

  const storedHtml = plain.bodyHtml || plain.body || '';
  const bodyHtml = plain.bodyHtml || sanitizeMessageHtml(storedHtml);
  const bodyText = plain.bodyText || htmlToPlainText(bodyHtml);

  const fileAssetIds = (plain.fileAssetIds || []).map((id) => String(id));

  return {
    ...plain,
    body: bodyHtml,
    bodyHtml,
    bodyText,
    fileAssetIds,
    attachments: Array.isArray(plain.attachments) ? plain.attachments : [],
  };
}

function serializeMessagesPage(payload) {
  if (!payload || !Array.isArray(payload.data)) {
    return payload;
  }
  return {
    ...payload,
    data: payload.data.map(serializeMessageForClient),
  };
}

function serializeConversationForClient(conversation) {
  if (!conversation) return conversation;
  const out = { ...conversation };
  if (out.lastMessage) {
    out.lastMessage = serializeMessageForClient(out.lastMessage);
  }
  return out;
}

function serializeConversationList(conversations) {
  if (!Array.isArray(conversations)) return conversations;
  return conversations.map(serializeConversationForClient);
}

module.exports = {
  serializeMessageForClient,
  serializeMessagesPage,
  serializeConversationForClient,
  serializeConversationList,
};
