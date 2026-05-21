import { useCallback, useState } from 'react';
import { refreshDownloadToken, resolveSecureFileUrl } from '../services/fileUploadApi';
import { extractFileAssetId, fileAccessErrorMessage } from '../utils/fileTypes';

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
        let target = resolveSecureFileUrl(url);
        const id = fileAssetId || extractFileAssetId(url);
        if (id && !url.includes('token=')) {
          const refreshed = await refreshDownloadToken(id);
          if (refreshed?.downloadUrl) target = resolveSecureFileUrl(refreshed.downloadUrl);
        }
        const token = localStorage.getItem('token');
        const res = await fetch(target, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          setError(fileAccessErrorMessage(res.status));
          return;
        }
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName || 'download';
        a.click();
        URL.revokeObjectURL(objectUrl);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(fileAccessErrorMessage(status, 'Download failed'));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { openFile, downloadFile, error, loading, clearError: () => setError(null) };
}
