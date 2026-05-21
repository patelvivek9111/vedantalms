import React, { useEffect, useState } from 'react';
import { LoadingInline } from '../../../design-system';
import { fetchAuthenticatedFile } from '../../../services/fileUploadApi';
import { fileAccessErrorMessage } from '../../../utils/fileTypes';

interface TextPreviewProps {
  fileAssetId: string;
  fallbackUrl?: string;
}

const TextPreview: React.FC<TextPreviewProps> = ({ fileAssetId, fallbackUrl }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const path =
          fallbackUrl?.includes('/preview/content') ? 'preview/content' : 'stream';
        const res = await fetchAuthenticatedFile(fileAssetId, path);
        if (!res.ok) throw new Error(fileAccessErrorMessage(res.status));
        const body = await res.text();
        if (!cancelled) setText(body.slice(0, 50000));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileAssetId, fallbackUrl]);

  if (loading) return <LoadingInline label="Loading preview…" />;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  return (
    <pre className="text-xs overflow-auto max-h-[70vh] p-4 bg-gray-50 dark:bg-gray-900 rounded whitespace-pre-wrap">
      {text}
    </pre>
  );
};

export default TextPreview;
