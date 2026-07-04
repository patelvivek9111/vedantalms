import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { X, Download } from 'lucide-react';
import BaseModal from '../common/BaseModal';
import {
  detectPreviewKind,
  extractFileAssetId,
  buildSecureStreamPath,
  isMongoObjectId,
  type NormalizedFile,
} from '../../utils/fileTypes';
import UnsupportedFileBanner from './UnsupportedFileBanner';
import ImagePreview from './previews/ImagePreview';
import PdfPreview from './previews/PdfPreview';
import TextPreview from './previews/TextPreview';
import MediaPreview from './previews/MediaPreview';
import OfficePreview from './previews/OfficePreview';
import DocxPreview from './previews/DocxPreview';
import { isDocxFile } from '../../utils/fileTypes';
import { useFileDownload } from '../../hooks/useFileDownload';
import { buildStreamUrl } from '../../services/fileUploadApi';
import FileAccessBanner from './FileAccessBanner';
import { useAuthenticatedFileBlob } from '../../hooks/useAuthenticatedFileBlob';
import { LoadingInline } from '../../design-system';

interface FilePreviewModalProps {
  file: NormalizedFile | null;
  open: boolean;
  onClose: () => void;
}

type FileApiResponse<T> = {
  data?: {
    success?: boolean;
    data?: T;
  };
} | null;

type FileMetadata = {
  originalName?: string;
  mimeType?: string;
  size?: number;
};

type FilePreviewData = {
  streamUrl?: string;
  thumbnailUrl?: string;
  previewCorrupted?: boolean;
};

function resolveSecureAssetId(file: NormalizedFile): string | null {
  const candidates = [file.fileAssetId, extractFileAssetId(file.url || '')];
  for (const candidate of candidates) {
    if (candidate && isMongoObjectId(String(candidate))) {
      return String(candidate);
    }
  }
  return null;
}

function resolveLegacyDirectUrl(file: NormalizedFile, secureAssetId: string | null): string | null {
  if (secureAssetId) return null;
  const url = file.url || '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return null;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, open, onClose }) => {
  const { downloadFile, error: downloadError, clearError } = useFileDownload();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStreamUrl, setPreviewStreamUrl] = useState<string | null>(null);
  const [previewCorrupted, setPreviewCorrupted] = useState(false);
  const [resolvedFile, setResolvedFile] = useState<NormalizedFile | null>(null);
  const [accessError, setAccessError] = useState('');
  const [legacyBlobUrl, setLegacyBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) {
      setPreviewStreamUrl(null);
      setResolvedFile(null);
      setAccessError('');
      setLegacyBlobUrl(null);
      return;
    }

    const secureAssetId = resolveSecureAssetId(file);
    const legacyDirectUrl = resolveLegacyDirectUrl(file, secureAssetId);

    if (!secureAssetId && !legacyDirectUrl) {
      setAccessError('This attachment has no secure file reference. Re-upload the file or contact your instructor.');
      setResolvedFile(file);
      return;
    }

    if (!secureAssetId && legacyDirectUrl) {
      setResolvedFile({ ...file, url: legacyDirectUrl });
      setPreviewStreamUrl(legacyDirectUrl);
      setPreviewCorrupted(false);
      setPreviewLoading(false);
      setAccessError('');
      return;
    }

    const fileAssetId = secureAssetId as string;
    const base: NormalizedFile = {
      ...file,
      fileAssetId,
      url: file.url || buildSecureStreamPath(fileAssetId),
    };
    setResolvedFile(base);
    setPreviewLoading(true);
    setAccessError('');

    const skipServerPreview = isDocxFile({ name: file.name, mimeType: file.mimeType });
    const metaPromise = api
      .get(`/files/${fileAssetId}/metadata`)
      .catch(() => null) as Promise<FileApiResponse<FileMetadata>>;
    const previewPromise = skipServerPreview
      ? Promise.resolve(null)
      : (api
          .get(`/files/${fileAssetId}/preview`)
          .catch(() => null) as Promise<FileApiResponse<FilePreviewData>>);

    Promise.all([metaPromise, previewPromise])
      .then(([metaRes, previewRes]) => {
        let next = { ...base };
        if (metaRes?.data?.success && metaRes.data.data) {
          const m = metaRes.data.data;
          next = {
            ...next,
            name: m.originalName || next.name,
            mimeType: m.mimeType,
            size: m.size,
          };
        }
        setResolvedFile(next);

        const clientDocx = isDocxFile(next);
        if (clientDocx) {
          setPreviewStreamUrl(buildStreamUrl(fileAssetId));
          setPreviewCorrupted(false);
        } else if (previewRes?.data?.success && previewRes.data.data) {
          const d = previewRes.data.data;
          setPreviewStreamUrl(d.streamUrl || d.thumbnailUrl || buildStreamUrl(fileAssetId));
          setPreviewCorrupted(Boolean(d.previewCorrupted));
        } else {
          setPreviewStreamUrl(buildStreamUrl(fileAssetId));
        }
      })
      .catch(() => {
        setPreviewStreamUrl(buildStreamUrl(fileAssetId));
      })
      .finally(() => setPreviewLoading(false));
  }, [open, file]);

  const previewFile = resolvedFile || file;
  const secureAssetId =
    previewFile ? resolveSecureAssetId(previewFile) : null;
  const legacyDirectUrl = previewFile
    ? resolveLegacyDirectUrl(previewFile, secureAssetId)
    : null;
  const fileAssetId = secureAssetId || undefined;
  const kind = previewFile
    ? detectPreviewKind({ name: previewFile.name, mimeType: previewFile.mimeType })
    : ('unsupported' as const);
  const needsBlob =
    open &&
    (Boolean(fileAssetId) || Boolean(legacyDirectUrl)) &&
    (kind === 'pdf' || kind === 'image' || kind === 'video' || kind === 'audio');
  const { blobUrl, loading: blobLoading, error: blobError } = useAuthenticatedFileBlob(
    fileAssetId,
    needsBlob && Boolean(fileAssetId),
    'stream'
  );

  useEffect(() => {
    if (!open || !legacyDirectUrl || !needsBlob || fileAssetId) {
      setLegacyBlobUrl(null);
      return;
    }

    let revoked: string | null = null;
    setLegacyBlobUrl(null);

    fetch(legacyDirectUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`File fetch failed (${res.status})`);
        }
        return res.blob();
      })
      .then((blob) => {
        revoked = URL.createObjectURL(blob);
        setLegacyBlobUrl(revoked);
      })
      .catch(() => {
        setAccessError('Unable to load this file preview. Try downloading the file instead.');
      });

    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, legacyDirectUrl, needsBlob, fileAssetId]);

  const effectiveBlobUrl = blobUrl || legacyBlobUrl;
  const isBlobLoading = fileAssetId ? blobLoading : needsBlob && !legacyBlobUrl && !accessError;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !file) return null;

  const display = resolvedFile || file;

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={display.name}
      size="xl"
      ariaLabelledBy="file-preview-title"
    >
      <div className="flex justify-end gap-2 mb-3">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 disabled:opacity-50"
          disabled={!fileAssetId && !legacyDirectUrl}
          onClick={() => {
            if (fileAssetId) {
              void downloadFile(display.url, display.name, fileAssetId);
            } else if (legacyDirectUrl) {
              window.open(legacyDirectUrl, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          <Download className="w-4 h-4" /> Download
        </button>
        <button
          ref={closeRef}
          type="button"
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <FileAccessBanner
        message={accessError || downloadError || blobError}
        onDismiss={() => {
          clearError();
          setAccessError('');
        }}
      />

      {(previewLoading || isBlobLoading) && (
        <p className="text-sm text-gray-500 mb-2">Loading preview…</p>
      )}
      {previewCorrupted && (
        <p className="text-sm text-amber-700 dark:text-amber-300 mb-2" role="status">
          Preview may be outdated. Use Download to open the original file.
        </p>
      )}

      {!fileAssetId && !legacyDirectUrl ? (
        <UnsupportedFileBanner />
      ) : kind === 'image' ? (
        effectiveBlobUrl ? (
          <ImagePreview url={effectiveBlobUrl} alt={display.name} />
        ) : blobError ? (
          <UnsupportedFileBanner />
        ) : (
          <LoadingInline label="Loading image…" />
        )
      ) : kind === 'pdf' ? (
        effectiveBlobUrl ? (
          <PdfPreview url={effectiveBlobUrl} title={display.name} />
        ) : blobError ? (
          <UnsupportedFileBanner />
        ) : (
          <LoadingInline label="Loading PDF…" />
        )
      ) : kind === 'office' && isDocxFile(display) && (fileAssetId || legacyDirectUrl) ? (
        <DocxPreview
          fileAssetId={fileAssetId}
          fileName={display.name}
          directUrl={legacyDirectUrl || undefined}
        />
      ) : kind === 'office' && fileAssetId ? (
        <OfficePreview fileAssetId={fileAssetId} fileName={display.name} />
      ) : kind === 'text' && fileAssetId ? (
        <TextPreview fileAssetId={fileAssetId} fallbackUrl={previewStreamUrl || undefined} />
      ) : kind === 'audio' ? (
        effectiveBlobUrl ? (
          <MediaPreview url={effectiveBlobUrl} kind="audio" title={display.name} />
        ) : (
          <LoadingInline label="Loading audio…" />
        )
      ) : kind === 'video' ? (
        effectiveBlobUrl ? (
          <MediaPreview url={effectiveBlobUrl} kind="video" title={display.name} />
        ) : (
          <LoadingInline label="Loading video…" />
        )
      ) : (
        <div className="space-y-3">
          <UnsupportedFileBanner />
          {(kind === 'unsupported' && (fileAssetId || legacyDirectUrl)) && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              <button
                type="button"
                className="text-indigo-600 underline"
                onClick={() => void downloadFile(display.url, display.name, fileAssetId)}
              >
                Download file
              </button>{' '}
              to view locally.
            </p>
          )}
        </div>
      )}
    </BaseModal>
  );
};

export default FilePreviewModal;
