/**
 * Build-time API base (no trailing slash, no /api suffix).
 * Empty string = same-origin `/api/...` (use with a host/proxy that forwards /api to the backend).
 */

const PLACEHOLDER_HOST_SUBSTRINGS = [
  'placeholder.onrender.com',
  'placeholder.',
  'your-backend-domain',
  'your-backend',
  'example.com',
  'changeme',
  'replace_me',
];

const looksLikePlaceholderApiUrl = (raw: string): boolean => {
  const s = raw.trim().toLowerCase();
  if (!s) return true;
  return PLACEHOLDER_HOST_SUBSTRINGS.some((frag) => s.includes(frag));
};

const normalizeApiBase = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return '';
  }
  if (looksLikePlaceholderApiUrl(url.hostname)) {
    return '';
  }
  const path = url.pathname.replace(/\/$/, '');
  let out = `${url.origin}${path === '/' ? '' : path}`;
  if (out.endsWith('/api')) {
    out = out.slice(0, -4);
  }
  return out.replace(/\/$/, '');
};

const getApiUrl = (): string => {
  const useSameOrigin = (import.meta as any).env?.VITE_USE_SAME_ORIGIN_API === 'true';
  if (useSameOrigin) {
    return '';
  }

  const envApiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envApiUrl && envApiUrl.trim()) {
    const normalized = normalizeApiBase(envApiUrl);
    if (normalized) {
      return normalized;
    }
    // Env was set but invalid / placeholder — fall through to same-origin or dev default.
  }

  // In production without a usable VITE_API_URL, default to same-origin API.
  // Safe when the host proxies /api to the backend (see root vercel.json).
  if ((import.meta as any).env?.MODE === 'production') {
    return '';
  }

  return 'http://localhost:5000';
};

export const API_URL = getApiUrl();

/** Browser app origin for QR deep links (join-course). Prefer VITE_APP_PUBLIC_URL in deployed envs. */
export const getAppPublicOrigin = (): string => {
  const fromEnv = (import.meta as any).env?.VITE_APP_PUBLIC_URL as string | undefined;
  if (fromEnv?.trim()) {
    return fromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
};

/**
 * Origin for Socket.IO (QuizWave). When API_URL is empty (browser → same-origin /api proxy),
 * sockets cannot terminate on the static CDN — connect to the real Node host instead.
 */
export const getBackendOrigin = (): string => {
  if (API_URL) {
    return API_URL.replace(/\/$/, '');
  }
  const socketEnv = ((import.meta as any).env?.VITE_SOCKET_ORIGIN as string | undefined) || '';
  const normalizedSocket = normalizeApiBase(socketEnv);
  if (normalizedSocket) {
    return normalizedSocket;
  }
  if ((import.meta as any).env?.MODE === 'production') {
    return 'https://vedantalms-backend.onrender.com';
  }
  return 'http://localhost:5000';
};
