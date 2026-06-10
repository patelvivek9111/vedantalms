const { sanitizeDiscussionHtml } = require('./discussionSanitizer.service');

/**
 * Plain-text extraction for notifications, search previews, and bodyText storage.
 * Mirrors NotificationCenter normalization without DOMParser (server-safe).
 */
function htmlToPlainText(html = '') {
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize message HTML. MESSAGE_SANITIZER=regex (default) uses discussion rules.
 * DOMPurify path reserved for a future flag value without changing call sites.
 */
function sanitizeMessageHtml(html = '') {
  const mode = (process.env.MESSAGE_SANITIZER || 'regex').toLowerCase();
  if (mode === 'dompurify') {
    try {
      const createDOMPurify = require('isomorphic-dompurify');
      const { JSDOM } = require('jsdom');
      const window = new JSDOM('').window;
      const DOMPurify = createDOMPurify(window);
      return DOMPurify.sanitize(String(html || ''), {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'blockquote'],
        ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
      });
    } catch {
      // Fall back when optional deps are not installed
    }
  }
  return sanitizeDiscussionHtml(html);
}

/**
 * Prepare persisted + API-facing message body fields (dual-write: body + bodyHtml + bodyText).
 */
function prepareMessageBody(rawHtml = '') {
  const trimmed = String(rawHtml || '').trim();
  const bodyHtml = sanitizeMessageHtml(trimmed);
  const bodyText = htmlToPlainText(bodyHtml);
  return {
    body: bodyHtml,
    bodyHtml,
    bodyText,
  };
}

module.exports = {
  sanitizeMessageHtml,
  htmlToPlainText,
  prepareMessageBody,
};
