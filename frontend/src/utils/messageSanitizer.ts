/**
 * Client-side message HTML sanitization (defense in depth).
 * Mirrors server discussionSanitizer / messageSanitizer regex rules.
 */
export function sanitizeMessageHtml(html: string = ''): string {
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(script|style)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'")
    .replace(/\s(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');
}

/** Prefer bodyHtml from API; fall back to legacy body. */
export function messageHtmlForRender(message: { bodyHtml?: string; body?: string } | null | undefined): string {
  if (!message) return '';
  return sanitizeMessageHtml(message.bodyHtml ?? message.body ?? '');
}
