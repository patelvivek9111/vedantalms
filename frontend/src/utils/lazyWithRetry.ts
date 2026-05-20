import { ComponentType, lazy } from 'react';

export const CHUNK_RELOAD_STORAGE_KEY = 'vedanta:chunk-reload';

/** Clear after a successful app boot so the next deploy can auto-reload once. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    (error.name === 'TypeError' &&
      (msg.includes('failed to fetch dynamically imported module') ||
        msg.includes('importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('failed to load module script') ||
        msg.includes('not a valid javascript mime type') ||
        msg.includes("'text/html' is not a valid"))) ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk')
  );
}

/**
 * Lazy import with a one-time full reload when a hashed chunk 404s after deploy
 * (stale index.html / parent bundle referencing removed chunk files).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry(factory: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(async () => {
    try {
      const module = await factory();
      clearChunkReloadFlag();
      return module;
    } catch (error) {
      if (isChunkLoadError(error)) {
        try {
          const reloaded = sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
          if (!reloaded) {
            sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, '1');
            window.location.reload();
            return new Promise(() => {
              /* pending until reload */
            });
          }
          sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
        } catch {
          /* ignore storage errors */
        }
      }
      throw error;
    }
  });
}
