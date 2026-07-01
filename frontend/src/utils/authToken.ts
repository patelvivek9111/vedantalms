import { authFetchInit } from './passwordPolicy';

let memoryToken: string | null = null;

/** Short-lived in-memory token for WebSocket auth when cookies are not forwarded. */
export function setMemoryAuthToken(token: string | null) {
  memoryToken = token;
}

export function getMemoryAuthToken(): string | null {
  return memoryToken;
}

export { authFetchInit };
