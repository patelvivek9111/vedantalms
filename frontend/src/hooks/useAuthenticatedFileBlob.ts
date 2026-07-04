import { useEffect, useState } from 'react';
import { fetchAuthenticatedFileBlob } from '../services/fileUploadApi';
import { fileAccessErrorMessage } from '../utils/fileTypes';

/**
 * Fetch file bytes with Authorization (+ download token) and expose a blob: URL for iframe/img/video.
 */
export function useAuthenticatedFileBlob(
  fileAssetId: string | undefined,
  enabled: boolean,
  resourcePath = 'stream'
) {
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
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const blob = await fetchAuthenticatedFileBlob(fileAssetId, resourcePath);
        revoked = URL.createObjectURL(blob);
        setBlobUrl(revoked);
      } catch (e) {
        const status = (e as { status?: number })?.status;
        const message = (e as Error).message;
        setError(
          status != null && status > 0
            ? fileAccessErrorMessage(status)
            : message || 'Unable to load file preview.'
        );
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileAssetId, enabled, resourcePath]);

  return { blobUrl, loading, error };
}
