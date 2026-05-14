/**
 * Parse join token from scanned QR text (full URL or raw token).
 */
export function extractJoinTokenFromQrText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const asUrl = trimmed.includes('://') ? new URL(trimmed) : new URL(trimmed, 'http://local.invalid');
    const t = asUrl.searchParams.get('t');
    if (t) return t.trim();
  } catch {
    // not a URL
  }
  const m = trimmed.match(/[?&]t=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1].trim());
    } catch {
      return m[1].trim();
    }
  }
  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Matches server-generated join codes (Crockford-style, 8 chars). */
const JOIN_CODE_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/i;

function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/gi, '');
}

/**
 * Resolve credential from pasted text, URL, or raw values for POST /enroll-by-qr.
 */
export function parseJoinCredential(text: string): { token?: string; joinCode?: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const token = extractJoinTokenFromQrText(trimmed);
  if (token) return { token };

  try {
    const asUrl = trimmed.includes('://') ? new URL(trimmed) : new URL(trimmed, 'http://local.invalid');
    const c = asUrl.searchParams.get('c');
    if (c) {
      const code = normalizeJoinCode(c);
      if (JOIN_CODE_RE.test(code)) return { joinCode: code };
    }
  } catch {
    /* ignore */
  }

  const only = normalizeJoinCode(trimmed);
  if (only.length === 8 && JOIN_CODE_RE.test(only)) return { joinCode: only };

  return null;
}
