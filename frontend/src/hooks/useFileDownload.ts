import { useCallback, useState } from 'react';
import { getMemoryAuthToken } from '../utils/authToken';
import { refreshDownloadToken, resolveSecureFileUrl } from '../services/fileUploadApi';
import { extractFileAssetId, fileAccessErrorMessage } from '../utils/fileTypes';
import { resolveDownloadFileName } from '../utils/filePreviewBlob';

function triggerNamedBlobDownload(blob: Blob, fileName: string) {
  const safeName = resolveDownloadFileName(fileName);
  const named =
    blob instanceof File && blob.name === safeName
      ? blob
      : new File([blob], safeName, {
          type: blob.type || 'application/octet-stream',
        });
  const objectUrl = URL.createObjectURL(named);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = safeName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function useFileDownload() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const openFile = useCallback(async (url: string, fileAssetId?: string) => {
    setError(null);
    setLoading(true);
    try {
      let target = resolveSecureFileUrl(url);
      const id = fileAssetId || extractFileAssetId(url);
      if (id && !url.includes('token=')) {
        try {
          const refreshed = await refreshDownloadToken(id);
          if (refreshed?.downloadUrl) target = resolveSecureFileUrl(refreshed.downloadUrl);
        } catch {
          /* use existing url */
        }
      }
      window.open(target, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(fileAccessErrorMessage(status));
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadFile = useCallback(
    async (url: string, fileName?: string, fileAssetId?: string) => {
      setError(null);
      setLoading(true);
      try {
        const id = fileAssetId || extractFileAssetId(url);
        const safeName = resolveDownloadFileName(fileName);
        // Prefer same-origin /stream (proxied) so Cloudinary redirects don't break blob download.
        if (id) {
          const { fetchAuthenticatedFileBlob } = await import('../services/fileUploadApi');
          const blob = await fetchAuthenticatedFileBlob(id, 'stream', { fileName: safeName });
          triggerNamedBlobDownload(blob, safeName);
          return;
        }

        let target = resolveSecureFileUrl(url);
        const token = getMemoryAuthToken();
        const res = await fetch(target, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (!res.ok) {
          setError(fileAccessErrorMessage(res.status));
          return;
        }
        const blob = await res.blob();
        triggerNamedBlobDownload(blob, safeName);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number }; status?: number })?.status
          ?? (err as { response?: { status?: number } })?.response?.status;
        setError(fileAccessErrorMessage(status, 'Download failed'));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { openFile, downloadFile, error, loading, clearError: () => setError(null) };
}
