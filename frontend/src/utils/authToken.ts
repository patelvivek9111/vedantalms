import { authFetchInit } from './passwordPolicy';

const SESSION_TOKEN_KEY = 'lms_auth_token';
let memoryToken: string | null = null;

function readSessionToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeSessionToken(token: string | null) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    else sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* private browsing / disabled storage */
  }
}

/** Short-lived in-memory token for WebSocket auth when cookies are not forwarded. */
export function setMemoryAuthToken(token: string | null) {
  memoryToken = token;
  writeSessionToken(token);
}

export function getMemoryAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  const stored = readSessionToken();
  if (stored) {
    memoryToken = stored;
    return stored;
  }
  return null;
}

/** Bearer header when a memory/session token exists (sockets, legacy axios). */
export function getAuthHeaders(): Record<string, string> {
  const token = getMemoryAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Axios/fetch config: cookie session plus optional Bearer for sockets and legacy callers. */
export function withAuthCredentials(extraHeaders: Record<string, string> = {}) {
  return {
    withCredentials: true as const,
    headers: {
      ...extraHeaders,
      ...getAuthHeaders(),
    },
  };
}

export { authFetchInit };
