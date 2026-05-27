function sanitizeDiscussionHtml(html = '') {
  if (!html) return '';
  let sanitized = String(html);
  sanitized = sanitized.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/<\/?(script|style)[^>]*>/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  sanitized = sanitized.replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"');
  sanitized = sanitized.replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'");
  sanitized = sanitized.replace(/\s(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');
  return sanitized;
}

module.exports = {
  sanitizeDiscussionHtml,
};
