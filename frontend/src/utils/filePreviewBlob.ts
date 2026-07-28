import { mimeTypeFromFileName } from './fileTypes';

/** Chrome's PDF iframe requires a typed blob; octet-stream renders as a blank panel. */
export function coercePreviewBlob(
  raw: Blob,
  options: { mimeType?: string; fileName?: string; kind?: 'pdf' | 'image' | 'audio' | 'video' }
): Blob {
  const fromName = options.fileName ? mimeTypeFromFileName(options.fileName) : undefined;
  const headerType = options.mimeType?.split(';')[0]?.trim();
  let type = raw.type?.split(';')[0]?.trim() || '';

  if (!type || type === 'application/octet-stream') {
    type = headerType || fromName || '';
  }
  if (!type && options.kind === 'pdf') {
    type = 'application/pdf';
  }
  if (!type) {
    return raw;
  }
  if (raw.type === type) {
    return raw;
  }
  return new Blob([raw], { type });
}

/**
 * Build an object URL. When fileName is provided, wrap as a File so download
 * attributes / some viewers can retain the original uploaded name.
 * Note: Chrome's built-in PDF viewer still labels blob: URLs with a UUID — use
 * #toolbar=0 + app Download, or Content-Disposition on HTTP URLs, for that case.
 */
export function createPreviewObjectUrl(blob: Blob, fileName?: string): string {
  const name = (fileName || '').trim();
  if (name) {
    const typed =
      blob instanceof File && blob.name === name
        ? blob
        : new File([blob], name, {
            type: blob.type || 'application/octet-stream',
          });
    return URL.createObjectURL(typed);
  }
  return URL.createObjectURL(blob);
}

/** Safe client download filename (never a bare UUID / empty placeholder). */
export function resolveDownloadFileName(
  fileName?: string | null,
  fallback = 'download'
): string {
  const raw = String(fileName || '').trim();
  if (!raw) return fallback;
  // Blob object-URL UUIDs look like this — never treat them as real names.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return fallback;
  }
  if (raw === 'blob' || raw === 'download' || raw === 'file') return fallback;
  return raw.replace(/[/\\?%*:|"<>]/g, '_');
}
