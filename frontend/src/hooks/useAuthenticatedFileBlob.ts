import { useEffect, useState } from 'react';
import { fetchAuthenticatedFileBlob } from '../services/fileUploadApi';
import { createPreviewObjectUrl, coercePreviewBlob } from '../utils/filePreviewBlob';
import { detectPreviewKind, fileAccessErrorMessage } from '../utils/fileTypes';

export type AuthenticatedFileBlobOptions = {
  resourcePath?: 'stream' | 'download';
  fileName?: string;
  mimeType?: string;
};

/**
 * Fetch file bytes with Authorization (+ download token) and expose a blob: URL for iframe/img/video.
 */
export function useAuthenticatedFileBlob(
  fileAssetId: string | undefined,
  enabled: boolean,
  options: AuthenticatedFileBlobOptions | string = 'stream'
) {
  const resolved =
    typeof options === 'string'
      ? { resourcePath: options as 'stream' | 'download' }
      : options;
  const resourcePath = resolved.resourcePath ?? 'stream';
  const fileName = resolved.fileName;
  const mimeType = resolved.mimeType;

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !fileAssetId) {
      setBlobUrl(null);
      setError(null);
      return;
    }

    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    (async () => {
      try {
        // Prefer /stream — backend proxies remote storage so the response is same-origin
        // and fetch().blob() works for iframe preview (Cloudinary redirects do not).
        const blob = await fetchAuthenticatedFileBlob(fileAssetId, resourcePath, {
          fileName,
          mimeType,
        });
        if (cancelled) return;
        revoked = createPreviewObjectUrl(blob, fileName);
        setBlobUrl(revoked);
      } catch (e) {
        if (cancelled) return;
        const status = (e as { status?: number })?.status;
        const message = (e as Error).message;
        setError(
          status != null && status > 0
            ? fileAccessErrorMessage(status)
            : message || 'Unable to load file preview.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileAssetId, enabled, resourcePath, fileName, mimeType]);

  return { blobUrl, loading, error };
}

/** Fetch a legacy http(s) URL into a typed blob URL for iframe/img preview. */
export function useLegacyDirectBlobUrl(
  directUrl: string | null | undefined,
  enabled: boolean,
  file?: { name?: string; mimeType?: string }
) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !directUrl) {
      setBlobUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    fetch(directUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`File fetch failed (${res.status})`);
        return res.blob().then((raw) => ({
          raw,
          headerType: res.headers.get('Content-Type') || undefined,
        }));
      })
      .then(({ raw, headerType }) => {
        if (cancelled) return;
        const kind = detectPreviewKind({
          name: file?.name || '',
          mimeType: file?.mimeType || headerType,
        });
        const typed = coercePreviewBlob(raw, {
          mimeType: file?.mimeType || headerType,
          fileName: file?.name,
          kind: kind === 'pdf' ? 'pdf' : undefined,
        });
        revoked = createPreviewObjectUrl(typed, file?.name);
        setBlobUrl(revoked);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Preview could not be loaded in-browser. Use Download to open the file.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [directUrl, enabled, file?.name, file?.mimeType]);

  return { blobUrl, loading, error };
}
