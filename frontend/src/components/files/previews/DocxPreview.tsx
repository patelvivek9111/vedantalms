import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { LoadingInline } from '../../../design-system';
import { fetchAuthenticatedFileBlob } from '../../../services/fileUploadApi';
import { fileAccessErrorMessage } from '../../../utils/fileTypes';

interface DocxPreviewProps {
  fileAssetId?: string;
  fileName: string;
  directUrl?: string;
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 0.7;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));
}

function zoomHostStyle(zoom: number): React.CSSProperties {
  if (typeof CSS !== 'undefined' && CSS.supports?.('zoom', '1')) {
    return { zoom };
  }
  return {
    transform: `scale(${zoom})`,
    transformOrigin: 'top center',
  };
}

/**
 * Renders the actual .docx layout (pages, tables, images) in the browser via docx-preview.
 */
const DocxPreview: React.FC<DocxPreviewProps> = ({ fileAssetId, fileName, directUrl }) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);

  useEffect(() => {
    setZoom(ZOOM_DEFAULT);
  }, [fileAssetId, directUrl]);

  useEffect(() => {
    let cancelled = false;
    const body = bodyRef.current;
    const style = styleRef.current;
    if (!body || !style) return;
    if (!fileAssetId && !directUrl) {
      setError('Unable to load this document preview.');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      body.innerHTML = '';
      style.innerHTML = '';

      try {
        const blob = directUrl
          ? await (await fetch(directUrl)).blob()
          : await fetchAuthenticatedFileBlob(fileAssetId as string, 'stream');
        if (cancelled) return;

        await renderAsync(blob, body, style, {
          className: 'docx-lms',
          inWrapper: false,
          ignoreWidth: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });
      } catch (e) {
        if (!cancelled) {
          const status = (e as { status?: number })?.status;
          setError(
            status
              ? fileAccessErrorMessage(status)
              : (e as Error).message || 'Could not render Word preview.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (bodyRef.current) bodyRef.current.innerHTML = '';
      if (styleRef.current) styleRef.current.innerHTML = '';
    };
  }, [fileAssetId, directUrl, reloadKey]);

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
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded">
          <LoadingInline label={`Rendering ${fileName}…`} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-1 mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">Document preview</p>
        <div
          className="flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-0.5"
          role="group"
          aria-label="Zoom controls"
        >
          <button
            type="button"
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom out"
            disabled={loading || zoom <= ZOOM_MIN}
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-xs tabular-nums min-w-[3rem] text-center text-gray-600 dark:text-gray-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom in"
            disabled={loading || zoom >= ZOOM_MAX}
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        className="docx-preview-shell overflow-auto max-h-[70vh] rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-4"
        aria-busy={loading}
      >
        <div className="docx-preview-zoom-host" style={zoomHostStyle(zoom)}>
          <div ref={styleRef} className="docx-preview-styles" aria-hidden />
          <div ref={bodyRef} className="docx-preview-body" />
        </div>
      </div>
    </div>
  );
};

export default DocxPreview;
