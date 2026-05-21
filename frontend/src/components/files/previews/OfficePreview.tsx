import React, { useEffect, useState } from 'react';
import { LoadingInline } from '../../../design-system';
import api from '../../../services/api';
import { fetchAuthenticatedFile } from '../../../services/fileUploadApi';
import { fileAccessErrorMessage } from '../../../utils/fileTypes';

interface OfficePreviewProps {
  fileAssetId: string;
  fileName: string;
}

type PreviewManifest = {
  status?: string;
  officeMetadata?: { wordCount?: number; slideCount?: number; sheetCount?: number };
};

function isEmptyPreviewText(body: string): boolean {
  const t = body.trim();
  return !t || t === '(No extractable text in this document.)';
}

async function fetchPreviewContent(fileAssetId: string): Promise<string> {
        const res = await fetchAuthenticatedFile(fileAssetId, 'preview/content');
  if (!res.ok) {
    if (res.status === 404) return '';
    throw new Error(fileAccessErrorMessage(res.status));
  }
  return res.text();
}

async function fetchManifest(fileAssetId: string): Promise<PreviewManifest | null> {
  const previewRes = await api.get(`/files/${fileAssetId}/preview`);
  return previewRes.data?.data?.manifest ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fallback for PowerPoint, Excel, legacy .doc, etc. (plain text extract via /preview/content).
 * .docx files use DocxPreview instead for full document layout.
 */
const OfficePreview: React.FC<OfficePreviewProps> = ({ fileAssetId, fileName }) => {
  const [text, setText] = useState('');
  const [meta, setMeta] = useState<{ wordCount?: number; slideCount?: number; sheetCount?: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setText('');

      try {
        let manifest = await fetchManifest(fileAssetId);
        if (cancelled) return;

        let body = '';
        const tryLoadContent = async () => {
          body = await fetchPreviewContent(fileAssetId);
          manifest = (await fetchManifest(fileAssetId)) || manifest;
        };

        await tryLoadContent();

        const needsRegen =
          isEmptyPreviewText(body) ||
          manifest?.status === 'failed' ||
          (manifest?.officeMetadata?.wordCount === 0 && isEmptyPreviewText(body));

        if (needsRegen && !cancelled) {
          await api.post(`/files/${fileAssetId}/preview/regenerate`);
          for (let i = 0; i < 8 && !cancelled; i += 1) {
            await sleep(400);
            await tryLoadContent();
            if (!isEmptyPreviewText(body)) break;
            if (manifest?.status === 'ready') break;
          }
        }

        if (cancelled) return;

        if (manifest?.officeMetadata) setMeta(manifest.officeMetadata);

        if (isEmptyPreviewText(body)) {
          setError('Could not extract text from this document. Use Download to open it in Word.');
          return;
        }

        setText(body.trim());
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || 'Could not load document preview.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileAssetId, reloadKey]);

  if (loading) {
    return <LoadingInline label={`Loading ${fileName}…`} />;
  }

  if (error) {
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
        <button
          type="button"
          className="text-sm text-indigo-600 underline"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          Retry preview
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {meta && (meta.wordCount != null || meta.slideCount != null || meta.sheetCount != null) && (
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
          {meta.wordCount != null && meta.wordCount > 0 && <span>{meta.wordCount} words</span>}
          {meta.slideCount != null && <span>{meta.slideCount} slides</span>}
          {meta.sheetCount != null && <span>{meta.sheetCount} sheets</span>}
          <span className="ml-1">· text preview (download for full layout)</span>
        </p>
      )}
      <pre className="text-sm overflow-auto max-h-[65vh] p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap leading-relaxed">
        {text}
      </pre>
    </div>
  );
};

export default OfficePreview;
